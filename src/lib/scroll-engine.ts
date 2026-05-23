import type { StoryParagraph, VisualState } from './types';

const INTRO_SCROLL_PX = 420;
const ZOOM_SCROLL_PX = 560;
const TEXT_SCROLL_PX = 720;
const ZOOM_TEXT_EXIT_THRESHOLD = 0.12;
const ZOOM_TEXT_EXIT_PROGRESS = 0.35;
const ZOOM_TEXT_PROGRESS_SHARE = 0.8;

export type StoryTimelineSegmentKind = 'hold' | 'zoom' | 'text';

export interface StoryTimelineSegment {
  kind: StoryTimelineSegmentKind;
  sectionIndex: number;
  startStateIndex: number;
  endStateIndex: number;
  paragraphIndex: number | null;
  start: number;
  length: number;
}

export interface StoryTimeline {
  segments: StoryTimelineSegment[];
  totalLength: number;
}

export interface StoryTimelineFrame {
  state: InterpolatedState;
  activeParagraphIndex: number | null;
  activeSectionIndex: number;
  phase: StoryTimelineSegmentKind;
}

function getParagraphIndexByStateIndex(
  states: VisualState[],
  paragraphs: StoryParagraph[]
): Array<number | null> {
  const stateIndexById = new Map(states.map((state, index) => [state.id, index]));
  const paragraphIndexesByStateId = new Map<string, number[]>();

  paragraphs.forEach((paragraph, index) => {
    const current = paragraphIndexesByStateId.get(paragraph.stateId) ?? [];
    current.push(index);
    paragraphIndexesByStateId.set(paragraph.stateId, current);
  });

  const hasDuplicateStateAssignments = Array.from(paragraphIndexesByStateId.values()).some(
    (indexes) => indexes.length > 1
  );
  const hasUnknownStateAssignments = paragraphs.some((paragraph) => !stateIndexById.has(paragraph.stateId));

  if (hasDuplicateStateAssignments || hasUnknownStateAssignments) {
    return states.map((_, index) => (index < paragraphs.length ? index : null));
  }

  return states.map((state) => paragraphIndexesByStateId.get(state.id)?.[0] ?? null);
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Cubic ease-in-out for cinematic feel */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Hold at each state's crop for the first/last 10% of a segment,
 * transition smoothly through the middle 80%.
 * This ensures each crop is shown exactly — not blended into "other" areas.
 */
function holdTransition(t: number): number {
  const hold = 0.1;
  if (t <= hold) return 0;
  if (t >= 1 - hold) return 1;
  return easeInOutCubic((t - hold) / (1 - 2 * hold));
}

export interface InterpolatedState {
  imageIndex: number;
  nextImageIndex: number | null;
  imageCrossfade: number;
  scale: number;
  x: number;
  y: number;
  overlays: VisualState['overlays'];
  nextOverlays: VisualState['overlays'];
  overlayOpacity: number;
  nextOverlayOpacity: number;
  activeParagraphIndex: number;
  paragraphProgress: number;
}

function hasParagraphText(paragraph?: StoryParagraph): boolean {
  if (!paragraph) return false;
  return paragraph.text.replace(/<[^>]*>/g, '').trim().length > 0;
}

function createStaticState(state: VisualState): InterpolatedState {
  return {
    imageIndex: state.imageIndex,
    nextImageIndex: null,
    imageCrossfade: 0,
    scale: state.zoom.scale,
    x: state.zoom.x,
    y: state.zoom.y,
    overlays: state.overlays,
    nextOverlays: [],
    overlayOpacity: state.overlays.length > 0 ? 1 : 0,
    nextOverlayOpacity: 0,
    activeParagraphIndex: 0,
    paragraphProgress: 0,
  };
}

function interpolateBetweenStates(
  states: VisualState[],
  startIndex: number,
  endIndex: number,
  localProgress: number
): InterpolatedState {
  const empty = createStaticState({
    id: 'empty',
    imageIndex: 0,
    zoom: { scale: 1, x: 0, y: 0 },
    overlays: [],
  });

  if (states.length === 0) return empty;

  const safeStart = Math.max(0, Math.min(states.length - 1, startIndex));
  const safeEnd = Math.max(0, Math.min(states.length - 1, endIndex));

  if (safeStart === safeEnd) {
    return createStaticState(states[safeStart]);
  }

  const A = states[safeStart];
  const B = states[safeEnd];
  const eased = easeInOutCubic(Math.max(0, Math.min(1, localProgress)));
  const zoomT = eased;
  const scale = lerp(A.zoom.scale, B.zoom.scale, zoomT);
  const x = lerp(A.zoom.x, B.zoom.x, zoomT);
  const y = lerp(A.zoom.y, B.zoom.y, zoomT);
  const imageChanging = A.imageIndex !== B.imageIndex;
  const imageCrossfade = imageChanging ? eased : 0;
  const overlayOpacity = A.overlays.length > 0 ? 1 - eased : 0;
  const nextOverlayOpacity = B.overlays.length > 0 ? eased : 0;

  return {
    imageIndex: A.imageIndex,
    nextImageIndex: imageChanging ? B.imageIndex : null,
    imageCrossfade,
    scale,
    x,
    y,
    overlays: A.overlays,
    nextOverlays: B.overlays,
    overlayOpacity,
    nextOverlayOpacity,
    activeParagraphIndex: 0,
    paragraphProgress: 0,
  };
}

export function buildStoryTimeline(
  states: VisualState[],
  paragraphs: StoryParagraph[]
): StoryTimeline {
  if (states.length === 0) {
    return { segments: [], totalLength: 0 };
  }

  const paragraphIndexByStateIndex = getParagraphIndexByStateIndex(states, paragraphs);

  let start = 0;
  const segments: StoryTimelineSegment[] = [];

  states.forEach((state, stateIndex) => {
    const paragraphIndex = paragraphIndexByStateIndex[stateIndex] ?? null;
    const paragraph = paragraphIndex === null ? undefined : paragraphs[paragraphIndex];

    if (stateIndex === 0 && INTRO_SCROLL_PX > 0) {
      segments.push({
        kind: 'hold',
        sectionIndex: stateIndex,
        startStateIndex: stateIndex,
        endStateIndex: stateIndex,
        paragraphIndex,
        start,
        length: INTRO_SCROLL_PX,
      });
      start += INTRO_SCROLL_PX;
    }

    if (stateIndex > 0) {
      segments.push({
        kind: 'zoom',
        sectionIndex: stateIndex,
        startStateIndex: stateIndex - 1,
        endStateIndex: stateIndex,
        paragraphIndex,
        start,
        length: ZOOM_SCROLL_PX,
      });
      start += ZOOM_SCROLL_PX;
    }

    if (hasParagraphText(paragraph)) {
      segments.push({
        kind: 'text',
        sectionIndex: stateIndex,
        startStateIndex: stateIndex,
        endStateIndex: stateIndex,
        paragraphIndex,
        start,
        length: TEXT_SCROLL_PX,
      });
      start += TEXT_SCROLL_PX;
    }
  });

  return { segments, totalLength: start };
}

export function resolveStoryTimelineFrame(
  states: VisualState[],
  timeline: StoryTimeline,
  progress: number
): StoryTimelineFrame {
  if (states.length === 0) {
    return {
      state: interpolateFromProgress([], 0, 0),
      activeParagraphIndex: null,
      activeSectionIndex: 0,
      phase: 'hold',
    };
  }

  if (timeline.totalLength <= 0 || timeline.segments.length === 0) {
    return {
      state: createStaticState(states[0]),
      activeParagraphIndex: null,
      activeSectionIndex: 0,
      phase: 'hold',
    };
  }

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const offset = clampedProgress * timeline.totalLength;
  const segmentIndex = timeline.segments.findIndex((entry) => offset <= entry.start + entry.length);
  const safeSegmentIndex = segmentIndex >= 0 ? segmentIndex : timeline.segments.length - 1;
  const segment = timeline.segments[safeSegmentIndex];

  const localOffset = offset - segment.start;
  const localProgress = segment.length > 0 ? localOffset / segment.length : 1;

  const baseState =
    segment.kind === 'zoom'
      ? interpolateBetweenStates(states, segment.startStateIndex, segment.endStateIndex, localProgress)
      : createStaticState(states[segment.endStateIndex]);

  let phase: StoryTimelineSegmentKind = segment.kind;
  let activeParagraphIndex: number | null = segment.kind === 'text' ? segment.paragraphIndex : null;
  let paragraphProgress = segment.kind === 'text' ? Math.max(0, Math.min(1, localProgress)) : 0;

  if (segment.kind === 'zoom' && segment.paragraphIndex !== null) {
    const previousTextSegment = timeline.segments
      .slice(0, safeSegmentIndex)
      .reverse()
      .find((entry) => entry.kind === 'text' && entry.paragraphIndex !== null);

    if (previousTextSegment && localProgress < ZOOM_TEXT_EXIT_THRESHOLD) {
      phase = 'text';
      activeParagraphIndex = previousTextSegment.paragraphIndex;
      paragraphProgress = 1 + (localProgress / ZOOM_TEXT_EXIT_THRESHOLD) * ZOOM_TEXT_EXIT_PROGRESS;
    } else {
      const revealProgress = previousTextSegment
        ? (localProgress - ZOOM_TEXT_EXIT_THRESHOLD) / (1 - ZOOM_TEXT_EXIT_THRESHOLD)
        : localProgress;

      phase = 'text';
      activeParagraphIndex = segment.paragraphIndex;
      paragraphProgress =
        Math.max(0, Math.min(1, revealProgress)) * ZOOM_TEXT_PROGRESS_SHARE;
    }
  }

  if (segment.kind === 'text' && segment.paragraphIndex !== null) {
    const previousSegment = timeline.segments[safeSegmentIndex - 1];
    if (
      previousSegment?.kind === 'zoom' &&
      previousSegment.paragraphIndex === segment.paragraphIndex
    ) {
      paragraphProgress =
        ZOOM_TEXT_PROGRESS_SHARE +
        Math.max(0, Math.min(1, localProgress)) * (1 - ZOOM_TEXT_PROGRESS_SHARE);
    }
  }

  if (
    segment.kind === 'zoom' &&
    segment.paragraphIndex === null &&
    localProgress < ZOOM_TEXT_EXIT_THRESHOLD
  ) {
    for (let index = safeSegmentIndex - 1; index >= 0; index -= 1) {
      const previousSegment = timeline.segments[index];
      if (previousSegment.kind === 'text' && previousSegment.paragraphIndex !== null) {
        phase = 'text';
        activeParagraphIndex = previousSegment.paragraphIndex;
        paragraphProgress = 1 + (localProgress / ZOOM_TEXT_EXIT_THRESHOLD) * ZOOM_TEXT_EXIT_PROGRESS;
        break;
      }
    }
  }

  return {
    state: {
      ...baseState,
      activeParagraphIndex: activeParagraphIndex ?? 0,
      paragraphProgress,
    },
    activeParagraphIndex,
    activeSectionIndex: segment.sectionIndex,
    phase,
  };
}

/**
 * Given a global progress (0–1) across all states, compute a fully
 * interpolated visual state. No discrete switching — everything blends.
 */
export function interpolateFromProgress(
  states: VisualState[],
  progress: number,
  paragraphCount: number
): InterpolatedState {
  const empty: InterpolatedState = {
    imageIndex: 0,
    nextImageIndex: null,
    imageCrossfade: 0,
    scale: 1,
    x: 0,
    y: 0,
    overlays: [],
    nextOverlays: [],
    overlayOpacity: 0,
    nextOverlayOpacity: 0,
    activeParagraphIndex: 0,
    paragraphProgress: 0,
  };

  if (states.length === 0) return empty;
  if (states.length === 1) {
    return {
      ...createStaticState(states[0]),
      activeParagraphIndex: 0,
      paragraphProgress: 0,
    };
  }

  const clamped = Math.max(0, Math.min(1, progress));

  // Map progress to a continuous position across N-1 segments
  const segments = states.length - 1;
  const rawPos = clamped * segments;
  const idx = Math.min(Math.floor(rawPos), segments - 1);
  const localT = rawPos - idx;

  const baseState = interpolateBetweenStates(states, idx, idx + 1, localT);

  // Active paragraph: map progress to paragraph index
  const paraPos = clamped * (paragraphCount - 1);
  const activeParagraphIndex = Math.round(paraPos);
  const paragraphProgress = paraPos - Math.floor(paraPos);

  return {
    ...baseState,
    activeParagraphIndex,
    paragraphProgress,
  };
}
