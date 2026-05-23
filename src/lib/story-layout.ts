import type { StoryParagraph, VisualState } from './types';

const DEFAULT_PARAGRAPH_TOP_PERCENT = 14;

export function clampParagraphTopPercent(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PARAGRAPH_TOP_PERCENT;
  return Math.max(0, Math.min(100, value ?? DEFAULT_PARAGRAPH_TOP_PERCENT));
}

export function getParagraphTopPercent(paragraph?: StoryParagraph | null): number {
  return clampParagraphTopPercent(paragraph?.textPosition?.topPercent);
}

export function getZoomFrameRect(zoom: VisualState['zoom']) {
  const width = 1 / zoom.scale;
  const height = 1 / zoom.scale;
  const centerX = 0.5 + zoom.x / 100;
  const centerY = 0.5 + zoom.y / 100;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    w: width,
    h: height,
  };
}