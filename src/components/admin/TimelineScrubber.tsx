import { useState, useCallback, useRef, useEffect } from 'react';
import type { Story } from '@/lib/types';
import { interpolateFromProgress } from '@/lib/scroll-engine';
import { VisualStage } from '@/components/story/VisualStage';
import { Play, Pause } from 'lucide-react';
import { getParagraphTopPercent } from '@/lib/story-layout';

interface Props {
  story: Story;
}

export function TimelineScrubber({ story }: Props) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef(0);

  const state = interpolateFromProgress(story.states, progress, story.paragraphs.length);
  const activeParagraph = story.paragraphs[state.activeParagraphIndex];
  const activeCaption = activeParagraph?.caption;
  const overlayTop = getParagraphTopPercent(activeParagraph);

  // Auto-play animation
  useEffect(() => {
    if (!playing) return;
    let start = performance.now();
    const duration = 12000; // 12s full scrub
    const startProgress = progress;

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      setProgress(startProgress + (1 - startProgress) * t);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setPlaying(false);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">
          Live Preview
        </h4>
        <span className="text-xs font-sans text-muted-foreground">
          {Math.round(progress * 100)}%
        </span>
      </div>

      {/* Preview viewport */}
      <div className="relative w-full overflow-hidden rounded-md" style={{ aspectRatio: '16/9' }}>
        <VisualStage
          images={story.images}
          state={state}
          title={story.title}
          caption={activeCaption}
        />
        {/* Active paragraph text overlay */}
        {activeParagraph && (
          <div
            className="absolute left-0 right-0 px-3 pointer-events-none"
            style={{
              top: `${overlayTop}%`,
            }}
          >
            <div className="mx-auto max-w-[220px]">
              <div
                className="rounded text-[10px] font-serif leading-relaxed"
                style={{
                  color: 'hsl(45,20%,90%)',
                  background: activeParagraph.textStyle?.backgroundColor ?? 'rgba(0,0,0,0.8)',
                  padding: `${activeParagraph.textStyle?.padding ?? 12}px`,
                  borderRadius: `${activeParagraph.textStyle?.borderRadius ?? 8}px`,
                }}
              >
                {activeParagraph.text.replace(/<[^>]*>/g, '').slice(0, 120)}…
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scrubber */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setPlaying(!playing); if (progress >= 1) setProgress(0); }}
          className="p-1.5 rounded hover:bg-secondary text-foreground"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={(e) => { setProgress(parseFloat(e.target.value)); setPlaying(false); }}
          className="flex-1 h-1.5 accent-accent cursor-pointer"
        />
      </div>

      {/* State markers on timeline */}
      <div className="relative h-2">
        {story.states.map((_, i) => {
          const pos = story.states.length > 1 ? i / (story.states.length - 1) : 0;
          return (
            <button
              key={i}
              onClick={() => { setProgress(pos); setPlaying(false); }}
              className="absolute top-0 w-1.5 h-1.5 rounded-full -translate-x-1/2 hover:scale-150 transition-transform"
              style={{
                left: `${pos * 100}%`,
                background: Math.abs(progress - pos) < 0.02 ? 'hsl(38, 60%, 55%)' : 'hsl(var(--muted-foreground))',
              }}
              title={`State ${i + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}
