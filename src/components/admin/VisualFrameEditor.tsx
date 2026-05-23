import { useState, useRef, useCallback, useEffect } from 'react';
import type { VisualState } from '@/lib/types';
import { Grid3x3, Crosshair, ZoomIn } from 'lucide-react';
import { getZoomFrameRect } from '@/lib/story-layout';

interface Props {
  image: string;
  state: VisualState;
  prevState?: VisualState;
  nextState?: VisualState;
  textPreview?: {
    html: string;
    backgroundColor: string;
    borderRadius: number;
    padding: number;
    topPercent: number;
  } | null;
  onChange: (zoom: VisualState['zoom']) => void;
}

const ASPECT = 9 / 16;

/** Convert frame rect → zoom state */
function frameToZoom(frame: { x: number; y: number; w: number; h: number }): VisualState['zoom'] {
  const scale = 1 / frame.w;
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  return {
    scale: Math.round(scale * 100) / 100,
    x: Math.round((cx - 0.5) * 10000) / 100,
    y: Math.round((cy - 0.5) * 10000) / 100,
  };
}

export function VisualFrameEditor({ image, state, prevState, nextState, textPreview, onChange }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [showCenter, setShowCenter] = useState(false);
  const [dragging, setDragging] = useState<'move' | 'resize' | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, fx: 0, fy: 0, fw: 0, fh: 0 });
  const hasDragged = useRef(false);

  const frame = getZoomFrameRect(state.zoom);

  const getCanvasRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    hasDragged.current = false;
    setDragging(mode);
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: frame.x, fy: frame.y, fw: frame.w, fh: frame.h };
  }, [frame]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    hasDragged.current = true;
    const rect = getCanvasRect();
    const dx = (e.clientX - dragStart.current.mx) / rect.width;
    const dy = (e.clientY - dragStart.current.my) / rect.height;

    if (dragging === 'move') {
      const nx = Math.max(0, Math.min(1 - dragStart.current.fw, dragStart.current.fx + dx));
      const ny = Math.max(0, Math.min(1 - dragStart.current.fh, dragStart.current.fy + dy));
      onChange(frameToZoom({ x: nx, y: ny, w: dragStart.current.fw, h: dragStart.current.fh }));
    } else {
      // Resize from bottom-right corner, maintain aspect by using width
      const nw = Math.max(0.05, Math.min(1, dragStart.current.fw + dx));
      const nh = nw; // keep square in normalized space (canvas is 9:16 so this maps to a portrait frame)
      const nx = Math.max(0, Math.min(1 - nw, dragStart.current.fx));
      const ny = Math.max(0, Math.min(1 - nh, dragStart.current.fy));
      onChange(frameToZoom({ x: nx, y: ny, w: nw, h: nh }));
    }
  }, [dragging, getCanvasRect, onChange]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleClickToCenter = useCallback((e: React.MouseEvent) => {
    if (hasDragged.current) { hasDragged.current = false; return; }
    if (dragging) return;
    const rect = getCanvasRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    const nx = Math.max(0, Math.min(1 - frame.w, cx - frame.w / 2));
    const ny = Math.max(0, Math.min(1 - frame.h, cy - frame.h / 2));
    onChange(frameToZoom({ x: nx, y: ny, w: frame.w, h: frame.h }));
  }, [frame, getCanvasRect, onChange, dragging]);

  const renderFrameOverlay = (f: { x: number; y: number; w: number; h: number }, color: string, label: string, dashed = true) => (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${f.x * 100}%`,
        top: `${f.y * 100}%`,
        width: `${f.w * 100}%`,
        height: `${f.h * 100}%`,
        border: `1.5px ${dashed ? 'dashed' : 'solid'} ${color}`,
        opacity: 0.5,
      }}
    >
      <span className="absolute -top-4 left-1 text-[9px] font-sans" style={{ color }}>{label}</span>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded text-xs ${showGrid ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:text-foreground'}`}
            title="Rule of thirds"
          >
            <Grid3x3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowCenter(!showCenter)}
            className={`p-1.5 rounded text-xs ${showCenter ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:text-foreground'}`}
            title="Center crosshair"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-sans text-muted-foreground">
          <ZoomIn className="w-3 h-3" />
          <span className="font-medium text-foreground">{state.zoom.scale.toFixed(1)}×</span>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative w-full overflow-hidden rounded-md cursor-crosshair select-none"
        style={{ aspectRatio: `${ASPECT}` }}
        onClick={handleClickToCenter}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Base image */}
        <img src={image} alt="" className="w-full h-full object-cover" draggable={false} />

        {/* Dimming outside frame */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `
            linear-gradient(to right,
              hsla(0,0%,0%,0.55) ${frame.x * 100}%,
              transparent ${frame.x * 100}%,
              transparent ${(frame.x + frame.w) * 100}%,
              hsla(0,0%,0%,0.55) ${(frame.x + frame.w) * 100}%
            )
          `,
        }} />
        {/* Top/bottom dim */}
        <div className="absolute pointer-events-none" style={{
          left: `${frame.x * 100}%`,
          width: `${frame.w * 100}%`,
          top: 0,
          height: `${frame.y * 100}%`,
          background: 'hsla(0,0%,0%,0.55)',
        }} />
        <div className="absolute pointer-events-none" style={{
          left: `${frame.x * 100}%`,
          width: `${frame.w * 100}%`,
          top: `${(frame.y + frame.h) * 100}%`,
          bottom: 0,
          background: 'hsla(0,0%,0%,0.55)',
        }} />

        {/* Ghost overlays for prev/next */}
        {prevState && renderFrameOverlay(getZoomFrameRect(prevState.zoom), 'hsl(200, 70%, 60%)', 'prev')}
        {nextState && renderFrameOverlay(getZoomFrameRect(nextState.zoom), 'hsl(120, 60%, 55%)', 'next')}

        {/* Current frame (draggable) */}
        <div
          className="absolute cursor-move"
          style={{
            left: `${frame.x * 100}%`,
            top: `${frame.y * 100}%`,
            width: `${frame.w * 100}%`,
            height: `${frame.h * 100}%`,
            border: '2px solid hsl(38, 60%, 55%)',
            boxShadow: '0 0 0 1px hsla(0,0%,0%,0.3)',
          }}
          onPointerDown={(e) => handlePointerDown(e, 'move')}
        >
          {/* Rule of thirds grid */}
          {showGrid && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 3 3" preserveAspectRatio="none">
              <line x1="1" y1="0" x2="1" y2="3" stroke="hsla(38,60%,55%,0.4)" strokeWidth="0.02" />
              <line x1="2" y1="0" x2="2" y2="3" stroke="hsla(38,60%,55%,0.4)" strokeWidth="0.02" />
              <line x1="0" y1="1" x2="3" y2="1" stroke="hsla(38,60%,55%,0.4)" strokeWidth="0.02" />
              <line x1="0" y1="2" x2="3" y2="2" stroke="hsla(38,60%,55%,0.4)" strokeWidth="0.02" />
            </svg>
          )}

          {/* Center crosshair */}
          {showCenter && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3 h-px bg-accent/60" />
              <div className="absolute h-3 w-px bg-accent/60" />
            </div>
          )}

          {textPreview?.html && (
            <div
              className="absolute left-1.5 right-1.5 pointer-events-none overflow-hidden"
              style={{
                top: `${textPreview.topPercent}%`,
                maxHeight: `calc(100% - ${textPreview.topPercent}% - 6px)`,
              }}
            >
              <div
                className="ql-content text-[11px] leading-relaxed text-white"
                style={{
                  backgroundColor: textPreview.backgroundColor,
                  borderRadius: `${textPreview.borderRadius}px`,
                  padding: `${textPreview.padding}px`,
                }}
                dangerouslySetInnerHTML={{ __html: textPreview.html }}
              />
            </div>
          )}

          {/* Resize handle (bottom-right) */}
          <div
            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-accent border border-accent-foreground/30 rounded-sm cursor-nwse-resize"
            onPointerDown={(e) => handlePointerDown(e, 'resize')}
          />
          {/* Resize handle (top-left for reference) */}
          <div
            className="absolute -top-1.5 -left-1.5 w-2 h-2 bg-accent/50 rounded-sm pointer-events-none"
          />
        </div>

        {/* Zoom level badge */}
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-sans font-medium pointer-events-none"
          style={{ background: 'hsla(0,0%,0%,0.6)', color: 'hsl(38, 60%, 55%)' }}>
          {state.zoom.scale.toFixed(1)}×
        </div>
      </div>
    </div>
  );
}
