import { useState } from 'react';
import { uuid } from '@/lib/utils';
import {
  EditorProvider,
  Editor,
  Toolbar,
  BtnBold,
  BtnItalic,
  BtnUnderline,
  BtnStrikeThrough,
  BtnNumberedList,
  BtnBulletList,
  BtnClearFormatting,
  HtmlButton,
  Separator,
} from 'react-simple-wysiwyg';
import { storyStore } from '@/lib/story-store';
import type { Story, VisualState, StoryParagraph, ParagraphTextStyle } from '@/lib/types';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { VisualFrameEditor } from './VisualFrameEditor';
import { TimelineScrubber } from './TimelineScrubber';
import { getParagraphTopPercent } from '@/lib/story-layout';

const BORDER_RADII = [0, 4, 8, 12, 16, 24];
const PADDINGS = [8, 12, 16, 20, 24, 32];
const DEFAULT_TEXT_BACKGROUND = 'rgba(0,0,0,0.8)';

function getBackgroundColor(backgroundColor?: string): string {
  const value = backgroundColor?.trim();
  return value ? value : DEFAULT_TEXT_BACKGROUND;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function parseColor(color: string): { r: number; g: number; b: number; a: number } {
  const rgba = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] !== undefined ? +rgba[4] : 1 };
  const hex = color.replace('#', '');
  if (hex.length >= 6)
    return { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16), a: 1 };
  return { r: 0, g: 0, b: 0, a: 0.8 };
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function ParagraphEditor({
  paragraph,
  index,
  stateIds,
  stateImages,
  onChange,
  onRemove,
}: {
  paragraph: StoryParagraph;
  index: number;
  stateIds: string[];
  stateImages: string[];
  onChange: (p: StoryParagraph) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const style = paragraph.textStyle ?? {};

  const updateStyle = (patch: Partial<ParagraphTextStyle>) =>
    onChange({ ...paragraph, textStyle: { ...style, ...patch } });

  const updatePosition = (topPercent: number) =>
    onChange({
      ...paragraph,
      textPosition: { topPercent },
    });

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').slice(0, 50);

  return (
    <div className="border border-border rounded-md p-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-sm font-sans font-medium text-foreground min-w-0"
        >
          <span className="flex-shrink-0">¶{index + 1}</span>
          <span className="truncate text-xs text-muted-foreground max-w-[200px]">
            {stripHtml(paragraph.text) || '(empty)'}…
          </span>
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <button onClick={onRemove} className="text-destructive hover:text-destructive/80">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-sans block mb-1">Linked State</label>
            <select
              value={paragraph.stateId}
              onChange={(e) => onChange({ ...paragraph, stateId: e.target.value })}
              className="w-full px-2 py-1.5 border border-input rounded-md text-sm bg-background font-sans"
            >
              {stateIds.map((stateId, stateIndex) => (
                <option key={stateId} value={stateId}>
                  {`State ${stateIndex + 1}${stateImages[stateIndex] ? ` - Image ${stateIndex + 1}` : ''}`}
                </option>
              ))}
            </select>
          </div>

          {/* Rich text editor */}
          <div>
            <label className="text-xs text-muted-foreground font-sans block mb-1">Content</label>
            <div className="rsw-dark">
              <EditorProvider>
              <Editor
                value={paragraph.text}
                onChange={(e) => onChange({ ...paragraph, text: e.target.value })}
              >
                <Toolbar>
                  <BtnBold /><BtnItalic /><BtnUnderline /><BtnStrikeThrough />
                  <Separator />
                  <span title="Text color" className="rsw-btn" style={{ display:'flex', alignItems:'center', gap:2, padding:'0 4px' }}>
                    A
                    <input type="color" defaultValue="#ffffff"
                      onChange={(e) => document.execCommand('foreColor', false, e.target.value)}
                      style={{ width:16, height:16, border:'none', padding:0, cursor:'pointer', background:'transparent' }}
                    />
                  </span>
                  <span title="Highlight" className="rsw-btn" style={{ display:'flex', alignItems:'center', gap:2, padding:'0 4px' }}>
                    H
                    <input type="color" defaultValue="#000000"
                      onChange={(e) => document.execCommand('hiliteColor', false, e.target.value)}
                      style={{ width:16, height:16, border:'none', padding:0, cursor:'pointer', background:'transparent' }}
                    />
                  </span>
                  <Separator />
                  <select defaultValue="3"
                    onChange={(e) => document.execCommand('fontSize', false, e.target.value)}
                    className="rsw-btn" style={{ background:'transparent', border:'none', color:'inherit', fontSize:11, cursor:'pointer' }}
                  >
                    <option value="1">Tiny</option>
                    <option value="2">Small</option>
                    <option value="3">Normal</option>
                    <option value="4">Medium</option>
                    <option value="5">Large</option>
                    <option value="6">XL</option>
                    <option value="7">XXL</option>
                  </select>
                  <select onChange={(e) => document.execCommand('fontName', false, e.target.value)}
                    className="rsw-btn" style={{ background:'transparent', border:'none', color:'inherit', fontSize:11, cursor:'pointer' }}
                  >
                    <option value="">Font</option>
                    <option value="serif">Serif</option>
                    <option value="sans-serif">Sans</option>
                    <option value="monospace">Mono</option>
                  </select>
                  <Separator />
                  <BtnNumberedList /><BtnBulletList />
                  <Separator />
                  <BtnClearFormatting /><HtmlButton />
                </Toolbar>
              </Editor>
              </EditorProvider>
            </div>
          </div>

          {/* Caption */}
          <div>
            <label className="text-xs text-muted-foreground font-sans block mb-1">Caption</label>
            <input
              value={paragraph.caption || ''}
              onChange={(e) => onChange({ ...paragraph, caption: e.target.value || undefined })}
              className="w-full px-2 py-1.5 border border-input rounded-md text-sm bg-background font-sans"
            />
          </div>

          {/* Box styling */}
          <div className="border border-border rounded-md p-3">
            <p className="text-[11px] font-semibold font-sans text-foreground uppercase tracking-wider mb-3">Box Style</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground font-sans block mb-1">Box Color</label>
                <input
                  type="color"
                  value={toHex(
                    parseColor(getBackgroundColor(style.backgroundColor)).r,
                    parseColor(getBackgroundColor(style.backgroundColor)).g,
                    parseColor(getBackgroundColor(style.backgroundColor)).b,
                  )}
                  onChange={(e) => {
                    const { a } = parseColor(getBackgroundColor(style.backgroundColor));
                    const { r, g, b } = parseColor(e.target.value);
                    updateStyle({ backgroundColor: `rgba(${r},${g},${b},${a})` });
                  }}
                  className="w-full h-8 rounded border border-input cursor-pointer bg-background p-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-sans block mb-1">
                  Opacity — {Math.round(parseColor(getBackgroundColor(style.backgroundColor)).a * 100)}%
                </label>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={parseColor(getBackgroundColor(style.backgroundColor)).a}
                  onChange={(e) => {
                    const { r, g, b } = parseColor(getBackgroundColor(style.backgroundColor));
                    updateStyle({ backgroundColor: `rgba(${r},${g},${b},${e.target.value})` });
                  }}
                  className="w-full mt-2 accent-accent"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-sans block mb-1">Radius</label>
                <select
                  value={style.borderRadius ?? 8}
                  onChange={(e) => updateStyle({ borderRadius: parseInt(e.target.value) })}
                  className="w-full px-2 py-1 border border-input rounded text-xs bg-background font-sans"
                >
                  {BORDER_RADII.map((r) => <option key={r} value={r}>{r}px</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-sans block mb-1">Padding</label>
                <select
                  value={style.padding ?? 16}
                  onChange={(e) => updateStyle({ padding: parseInt(e.target.value) })}
                  className="w-full px-2 py-1 border border-input rounded text-xs bg-background font-sans"
                >
                  {PADDINGS.map((p) => <option key={p} value={p}>{p}px</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-md p-3">
            <p className="text-[11px] font-semibold font-sans text-foreground uppercase tracking-wider mb-3">Position In Crop</p>
            <div>
              <label className="text-[10px] text-muted-foreground font-sans block mb-1">
                Top Offset - {Math.round(getParagraphTopPercent(paragraph))}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={getParagraphTopPercent(paragraph)}
                onChange={(e) => updatePosition(parseInt(e.target.value, 10))}
                className="w-full accent-accent"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function uploadImage(file: File): Promise<string> {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataURL = reader.result as string;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, data: dataURL }),
        });
        if (res.ok) {
          const json = await res.json();
          resolve(json.url);
          return;
        }
      } catch { /* fall through */ }
      resolve(dataURL); // fallback: store as base64
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export function StoryEditor({ story, onClose }: { story: Story; onClose: () => void }) {
  const [data, setData] = useState<Story>(JSON.parse(JSON.stringify(story)));
  const [activeStateIdx, setActiveStateIdx] = useState(0);

  const save = () => {
    storyStore.save(data);
    onClose();
  };

  const addState = () => {
    const newState: VisualState = {
      id: uuid(),
      imageIndex: 0,
      zoom: { scale: 3.1, x: 0, y: 0 },
      overlays: [],
    };
    setData({ ...data, states: [...data.states, newState] });
    setActiveStateIdx(data.states.length);
  };

  const addParagraph = () => {
    const defaultStateIndex = Math.min(data.paragraphs.length, Math.max(data.states.length - 1, 0));
    const newP: StoryParagraph = {
      id: uuid(),
      text: '',
      stateId: data.states[defaultStateIndex]?.id || data.states[0]?.id || '',
    };
    setData({ ...data, paragraphs: [...data.paragraphs, newP] });
  };

  const updateState = (idx: number, s: VisualState) => {
    const states = [...data.states];
    states[idx] = s;
    setData({ ...data, states });
  };

  const removeState = (idx: number) => {
    setData({ ...data, states: data.states.filter((_, j) => j !== idx) });
    if (activeStateIdx >= data.states.length - 1) setActiveStateIdx(Math.max(0, data.states.length - 2));
  };

  const currentState = data.states[activeStateIdx];
  const currentImage = currentState ? (data.images[currentState.imageIndex] || data.images[0]) : data.images[0];
  const activeParagraph = currentState
    ? data.paragraphs.find((paragraph) => paragraph.stateId === currentState.id)
    : undefined;
  const activeParagraphStyle = activeParagraph?.textStyle ?? {};

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-sans">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex gap-2">
          {data.paragraphs.length > 0 && (
            <Link
              to={`/stories/${data.slug}`}
              target="_blank"
              className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-md text-foreground hover:bg-secondary font-sans"
            >
              <Eye className="w-4 h-4" /> Preview
            </Link>
          )}
          <button onClick={save} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 font-sans">
            Save
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-sans text-muted-foreground mb-1 block">Title</label>
          <input value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background font-sans" />
        </div>
        <div>
          <label className="text-xs font-sans text-muted-foreground mb-1 block">Slug</label>
          <input value={data.slug} onChange={(e) => setData({ ...data, slug: e.target.value })} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background font-sans" />
        </div>
      </div>
      <div className="mb-4">
        <label className="text-xs font-sans text-muted-foreground mb-1 block">Subtitle</label>
        <input value={data.subtitle} onChange={(e) => setData({ ...data, subtitle: e.target.value })} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background font-sans" />
      </div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div>
          <label className="text-xs font-sans text-muted-foreground mb-1 block">Author</label>
          <input value={data.author} onChange={(e) => setData({ ...data, author: e.target.value })} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background font-sans" />
        </div>
        <div>
          <label className="text-xs font-sans text-muted-foreground mb-1 block">Date</label>
          <input value={data.date} onChange={(e) => setData({ ...data, date: e.target.value })} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background font-sans" />
        </div>
        <div>
          <label className="text-xs font-sans text-muted-foreground mb-1 block">Cover Image</label>
          <label className="flex items-center gap-2 cursor-pointer w-full px-3 py-2 border border-input rounded-md text-sm bg-background font-sans hover:border-accent/50 transition-colors">
            {data.coverImage
              ? <img src={data.coverImage} alt="cover" className="h-6 w-10 object-cover rounded" />
              : <span className="text-muted-foreground">Choose file…</span>}
            <input
              type="file" accept="image/*" className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setData({ ...data, coverImage: await uploadImage(file) });
              }}
            />
          </label>
        </div>
        <div>
          <label className="text-xs font-sans text-muted-foreground mb-1 block">Status</label>
          <select value={data.status} onChange={(e) => setData({ ...data, status: e.target.value as 'draft' | 'published' })} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background font-sans">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      {/* Story Images */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-sans text-muted-foreground">Story Images <span className="text-[10px]">(used as visual frames — order matters)</span></label>
          <label className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 cursor-pointer font-sans">
            <Plus className="w-3 h-3" /> Add images
            <input
              type="file" accept="image/*" multiple className="sr-only"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                const urls = await Promise.all(files.map(uploadImage));
                setData(prev => {
                  const startIdx = prev.images.length;
                  const newStates: VisualState[] = urls.map((_, i) => ({
                    id: uuid(),
                    imageIndex: startIdx + i,
                    zoom: { scale: 3.1, x: 0, y: 0 },
                    overlays: [],
                  }));
                  return {
                    ...prev,
                    images: [...prev.images, ...urls],
                    states: [...prev.states, ...newStates],
                  };
                });
                setActiveStateIdx(prev => prev); // keep selection stable
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {data.images.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-4 text-center text-xs text-muted-foreground font-sans">
            No images yet — click "Add images" to upload
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.images.map((src, i) => (
              <div key={i} className="relative group">
                <img src={src} alt={`frame ${i + 1}`} className="h-16 w-24 object-cover rounded border border-border" />
                <span className="absolute top-0.5 left-1 text-[10px] text-white font-bold drop-shadow">{i + 1}</span>
                <button
                  onClick={() => setData({ ...data, images: data.images.filter((_, j) => j !== i) })}
                  className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main editor: 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* States list */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-sm font-semibold">States</h3>
            <button onClick={addState} className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-sans">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
            {data.states.map((s, i) => (
              <div
                key={s.id}
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-xs font-sans transition-colors ${
                  i === activeStateIdx ? 'bg-accent/15 text-accent border border-accent/30' : 'hover:bg-secondary border border-transparent'
                }`}
                onClick={() => setActiveStateIdx(i)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">S{i + 1}</span>
                  <span className="text-muted-foreground">
                    {s.zoom.scale.toFixed(1)}×
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeState(i); }}
                  className="text-muted-foreground hover:text-destructive p-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Visual Frame Editor */}
        <div className="lg:col-span-5">
          {currentState && currentImage ? (
            <div className="space-y-4">
              <h3 className="font-serif text-sm font-semibold">
                Frame — State {activeStateIdx + 1}
              </h3>
              <VisualFrameEditor
                image={currentImage}
                state={currentState}
                prevState={data.states[activeStateIdx - 1]}
                nextState={data.states[activeStateIdx + 1]}
                textPreview={activeParagraph?.text
                  ? {
                      html: activeParagraph.text,
                      backgroundColor: getBackgroundColor(activeParagraphStyle.backgroundColor),
                      borderRadius: activeParagraphStyle.borderRadius ?? 8,
                      padding: activeParagraphStyle.padding ?? 16,
                      topPercent: getParagraphTopPercent(activeParagraph),
                    }
                  : null}
                onChange={(zoom) => updateState(activeStateIdx, { ...currentState, zoom })}
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-sans block mb-0.5">Image #</label>
                  <input
                    type="number"
                    min={0}
                    max={data.images.length - 1}
                    value={currentState.imageIndex}
                    onChange={(e) => updateState(activeStateIdx, { ...currentState, imageIndex: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1 border border-input rounded text-xs bg-background font-sans"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-sans block mb-0.5">Easing</label>
                  <select
                    value={currentState.easing || 'ease-in-out'}
                    onChange={(e) => updateState(activeStateIdx, { ...currentState, easing: e.target.value as VisualState['easing'] })}
                    className="w-full px-2 py-1 border border-input rounded text-xs bg-background font-sans"
                  >
                    <option value="ease-in-out">Ease In-Out</option>
                    <option value="ease-out">Ease Out</option>
                    <option value="linear">Linear</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <div className="text-[10px] font-sans text-muted-foreground">
                    Pan: ({currentState.zoom.x.toFixed(1)}, {currentState.zoom.y.toFixed(1)})
                  </div>
                </div>
              </div>

              {/* Live Preview Scrubber */}
              <div className="border-t border-border pt-4">
                <TimelineScrubber story={data} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 border border-dashed border-border rounded-md">
              <p className="text-sm text-muted-foreground font-sans">Select or add a state</p>
            </div>
          )}
        </div>

        {/* Paragraphs */}
        <div className="lg:col-span-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-sm font-semibold">Paragraphs</h3>
            <button onClick={addParagraph} className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-sans">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {data.paragraphs.map((para, i) => (
              <ParagraphEditor
                key={para.id}
                paragraph={para}
                index={i}
                stateIds={data.states.map((s) => s.id)}
                stateImages={data.states.map((s) => data.images[s.imageIndex] || '')}
                onChange={(p) => {
                  const paragraphs = [...data.paragraphs];
                  paragraphs[i] = p;
                  setData({ ...data, paragraphs });
                }}
                onRemove={() => setData({ ...data, paragraphs: data.paragraphs.filter((_, j) => j !== i) })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
