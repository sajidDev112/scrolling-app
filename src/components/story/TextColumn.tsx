import React from 'react';
import type { StoryParagraph } from '@/lib/types';
import type { StoryTimeline } from '@/lib/scroll-engine';
import { getParagraphTopPercent } from '@/lib/story-layout';

const DEFAULT_TEXT_BACKGROUND = 'rgba(0,0,0,0.8)';
const TEXT_ENTRY_PROGRESS_SPAN = 0.88;
const TEXT_ENTRY_START_Y_VH = 118;
const TEXT_ENTRY_TRAVEL_Y_VH = 118;
const TEXT_ENTRY_EASING_POWER = 1.4;
const TEXT_EXIT_OVERTRAVEL_VH = 28;
const ZOOM_TEXT_PROGRESS_SHARE = 0.8;
const ZOOM_TEXT_EXIT_PROGRESS = 0.35;

function getBackgroundColor(backgroundColor?: string): string {
  const value = backgroundColor?.trim();
  return value ? value : DEFAULT_TEXT_BACKGROUND;
}

function easeOutProgress(value: number, power: number): number {
  return Math.pow(value, power);
}

interface Props {
  paragraphs: StoryParagraph[];
  timeline: StoryTimeline;
  activeSectionIndex: number;
  activeParagraphIndex: number | null;
  activePhase: 'hold' | 'zoom' | 'text';
  activeParagraphProgress: number;
}

/**
 * Text column is purely presentational — it does NOT drive visuals.
 * Active paragraph is determined by the scroll engine's global progress.
 */
export function TextColumn({
  paragraphs,
  timeline,
  activeSectionIndex,
  activeParagraphIndex,
  activePhase,
  activeParagraphProgress,
}: Props) {
  const activeParagraph =
    activeParagraphIndex === null ? null : paragraphs[activeParagraphIndex] ?? null;
  const activeStyle = activeParagraph?.textStyle ?? {};
  const activeHasText = !!activeParagraph?.text?.replace(/<[^>]*>/g, '').trim().length;
  const progress = activePhase === 'text' && activeHasText
    ? Math.max(0, activeParagraphProgress)
    : activeHasText
      ? 1
      : 0;
  const entryRatio = Math.min(progress / TEXT_ENTRY_PROGRESS_SPAN, 1);
  const entryProgress = easeOutProgress(entryRatio, TEXT_ENTRY_EASING_POWER);
  const translateY = `${TEXT_ENTRY_START_Y_VH - entryProgress * TEXT_ENTRY_TRAVEL_Y_VH}vh`;
  const activeBoxStyle: React.CSSProperties = {
    backgroundColor: getBackgroundColor(activeStyle.backgroundColor),
    borderRadius: `${activeStyle.borderRadius ?? 8}px`,
    padding: `${activeStyle.padding ?? 16}px`,
    lineHeight: 1.6,
  };
  const topPercent = getParagraphTopPercent(activeParagraph);
  const shouldHideAtTop = topPercent === 0 && entryProgress >= 1;
  const previousParagraphIndex = activeSectionIndex > 0
    ? timeline.segments
        .slice()
        .reverse()
        .find((segment) => segment.kind === 'text' && segment.sectionIndex < activeSectionIndex && segment.paragraphIndex !== null)
        ?.paragraphIndex ?? null
    : null;
  const outgoingParagraph = previousParagraphIndex === null ? null : paragraphs[previousParagraphIndex] ?? null;
  const outgoingStyle = outgoingParagraph?.textStyle ?? {};
  const outgoingTopPercent = getParagraphTopPercent(outgoingParagraph);
  const outgoingBoxStyle: React.CSSProperties = {
    backgroundColor: getBackgroundColor(outgoingStyle.backgroundColor),
    borderRadius: `${outgoingStyle.borderRadius ?? 8}px`,
    padding: `${outgoingStyle.padding ?? 16}px`,
    lineHeight: 1.6,
  };
  const outgoingProgress = activeParagraphIndex === previousParagraphIndex
    ? Math.max(0, Math.min(1, (activeParagraphProgress - 1) / ZOOM_TEXT_EXIT_PROGRESS))
    : activePhase === 'text' && previousParagraphIndex !== null && activeParagraphIndex !== previousParagraphIndex
      ? Math.max(0, Math.min(1, activeParagraphProgress / ZOOM_TEXT_PROGRESS_SHARE))
      : 0;
  const isSameAsActiveParagraph = outgoingParagraph?.id === activeParagraph?.id;
  const showOutgoingParagraph =
    !isSameAsActiveParagraph &&
    !!outgoingParagraph?.text?.replace(/<[^>]*>/g, '').trim().length &&
    outgoingProgress > 0 &&
    outgoingProgress < 1;
  const outgoingEaseProgress = easeOutProgress(outgoingProgress, TEXT_ENTRY_EASING_POWER);
  const outgoingTranslateY = `-${(outgoingTopPercent + TEXT_EXIT_OVERTRAVEL_VH) * outgoingEaseProgress}vh`;

  const renderParagraph = (
    paragraph: StoryParagraph,
    boxStyle: React.CSSProperties,
    top: number,
    opacity: number,
    transform: string,
  ) => (
    <div
      className="absolute left-0 right-0 px-6 transition-opacity duration-150 md:px-0"
      style={{
        opacity,
        top: `${top}%`,
        transform,
        willChange: 'transform, opacity',
      }}
    >
      <div className="mx-auto max-w-[520px]">
        <div
          style={boxStyle}
          className="ql-content"
          dangerouslySetInnerHTML={{ __html: paragraph.text }}
        />
      </div>
    </div>
  );

  return (
    <div className="relative z-10">
      <div className="sticky top-0 h-screen overflow-hidden pointer-events-none">
        {showOutgoingParagraph && outgoingParagraph && renderParagraph(
          outgoingParagraph,
          outgoingBoxStyle,
          outgoingTopPercent,
          outgoingEaseProgress < 0.94 ? 1 : 1 - (outgoingEaseProgress - 0.94) / 0.06,
          `translate3d(0, ${outgoingTranslateY}, 0)`
        )}
        {activeParagraph && activeHasText && renderParagraph(
          activeParagraph,
          activeBoxStyle,
          topPercent,
          shouldHideAtTop ? 0 : 1,
          `translate3d(0, ${translateY}, 0)`
        )}
      </div>

      {/* Spacer to push text below the fold */}
      <div className="h-[70vh]" />

      {timeline.segments.map((segment, index) => {
        return <div key={`${segment.kind}-${segment.sectionIndex}-${index}`} style={{ height: segment.length }} />;
      })}

      {/* Bottom spacer */}
      <div className="h-[50vh]" />
    </div>
  );
}
