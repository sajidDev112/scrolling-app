import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Story } from '@/lib/types';
import { buildStoryTimeline, resolveStoryTimelineFrame } from '@/lib/scroll-engine';
import { VisualStage } from './VisualStage';
import { TextColumn } from './TextColumn';
import { ScrollProgress } from './ScrollProgress';
import { Link, useNavigate } from 'react-router-dom';
import backButtonImage from '@/assets/back_button.png';
import downIcon from '@/assets/down_icon.png';

interface Props {
  story: Story;
}

const SMOOTH_FACTOR = 0.026;
const VISUAL_SMOOTH_FACTOR = 0.0032;
const IMMEDIATE_PROGRESS_FACTOR = 0.18;
const MIN_IMMEDIATE_PROGRESS_DELTA = 0.03;
const BACK_BUTTON_PRESS_FEEDBACK_MS = 120;
const WHEEL_GESTURE_COOLDOWN_MS = 450;
const SECTION_SCROLL_DURATION_MS = 5400;
const TOUCH_GESTURE_THRESHOLD_PX = 12;
const INTRO_PROGRESS = 0;
const END_SCROLL_CUE_HIDE_PROGRESS = 0.995;
const END_SCROLL_CUE_HIDE_OFFSET_PX = 2;

function getViewportMotionSettings() {
  if (typeof window === 'undefined') {
    return {
      smoothFactor: SMOOTH_FACTOR,
      visualSmoothFactor: VISUAL_SMOOTH_FACTOR,
      immediateProgressFactor: IMMEDIATE_PROGRESS_FACTOR,
      minImmediateProgressDelta: MIN_IMMEDIATE_PROGRESS_DELTA,
      sectionScrollDurationMs: SECTION_SCROLL_DURATION_MS,
    };
  }

  const aspectRatio = window.innerWidth / Math.max(window.innerHeight, 1);
  const viewportHeight = window.innerHeight;
  const portraitWeight = Math.max(0, Math.min(1, (1 - aspectRatio) / 0.45));
  const tallViewportWeight = Math.max(0, Math.min(1, (viewportHeight - 1200) / 1000));
  const kioskPortraitWeight = portraitWeight * tallViewportWeight;

  return {
    smoothFactor: Math.max(0.01, SMOOTH_FACTOR - portraitWeight * 0.008 - kioskPortraitWeight * 0.006),
    visualSmoothFactor: Math.max(0.0014, VISUAL_SMOOTH_FACTOR - portraitWeight * 0.001 - kioskPortraitWeight * 0.0008),
    immediateProgressFactor: Math.max(0.08, IMMEDIATE_PROGRESS_FACTOR - portraitWeight * 0.03 - kioskPortraitWeight * 0.025),
    minImmediateProgressDelta: Math.max(0.014, MIN_IMMEDIATE_PROGRESS_DELTA - portraitWeight * 0.006 - kioskPortraitWeight * 0.004),
    sectionScrollDurationMs: SECTION_SCROLL_DURATION_MS + portraitWeight * 2200 + kioskPortraitWeight * 2600,
  };
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function getBackgroundColor(backgroundColor?: string): string {
  const value = backgroundColor?.trim();
  return value ? value : 'rgba(0,0,0,0.8)';
}

export function StoryViewer({ story }: Props) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const smoothScrollRef = useRef(0);
  const visualScrollRef = useRef(0);
  const targetScrollRef = useRef(0);
  const rafRef = useRef<number>(0);
  const scrollAnimationRef = useRef<number | null>(null);
  const gestureLockRef = useRef(false);
  const pendingDirectionRef = useRef<-1 | 1 | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchTriggeredRef = useRef(false);
  const lastWheelAtRef = useRef(0);
  const wheelGestureActiveRef = useRef(false);
  const wheelGestureTimeoutRef = useRef<number | null>(null);
  const targetSectionIndexRef = useRef(0);
  const hasEnteredFirstSectionRef = useRef(false);
  const backButtonTimeoutRef = useRef<number | null>(null);
  const viewerStates = useMemo(() => {
    if (story.states.length === 0) {
      return [];
    }

    const firstState = story.states[0];
    const introState = {
      id: `${story.id}-intro`,
      imageIndex: firstState.imageIndex,
      zoom: { scale: 1, x: 0, y: 0 },
      overlays: [],
    };

    return [introState, ...story.states];
  }, [story.id, story.states]);
  const hasIntroSection = viewerStates.length > story.states.length;
  const timeline = useMemo(
    () => buildStoryTimeline(viewerStates, story.paragraphs),
    [viewerStates, story.paragraphs]
  );
  const sectionProgressStops = useMemo(() => {
    if (viewerStates.length === 0) return [0];

    const preferredStops = new Map<number, number>();
    const fallbackStops = new Map<number, number>();

    for (const segment of timeline.segments) {
      const segmentEndProgress =
        timeline.totalLength > 0 ? (segment.start + segment.length) / timeline.totalLength : 0;

      fallbackStops.set(
        segment.sectionIndex,
        segmentEndProgress
      );

      const isPreferredTextStop = segment.kind === 'text';

      if (isPreferredTextStop) {
        preferredStops.set(segment.sectionIndex, segmentEndProgress);
      }
    }

    return viewerStates.map((_, index) => {
      if (index === 0 && hasIntroSection) {
        return INTRO_PROGRESS;
      }

      return preferredStops.get(index) ?? fallbackStops.get(index) ?? 1;
    });
  }, [hasIntroSection, timeline, viewerStates]);

  const [timelineFrame, setTimelineFrame] = useState(() =>
    resolveStoryTimelineFrame(viewerStates, timeline, 0)
  );
  const [visualTimelineFrame, setVisualTimelineFrame] = useState(() =>
    resolveStoryTimelineFrame(viewerStates, timeline, 0)
  );
  const [activeDotSectionIndex, setActiveDotSectionIndex] = useState(() =>
    resolveStoryTimelineFrame(viewerStates, timeline, 0).activeSectionIndex
  );
  const [globalProgress, setGlobalProgress] = useState(0);
  const [isAtStoryEnd, setIsAtStoryEnd] = useState(false);
  const [isBackButtonPressed, setIsBackButtonPressed] = useState(false);

  useEffect(() => {
    if (!gestureLockRef.current) {
      targetSectionIndexRef.current = timelineFrame.activeSectionIndex;
    }
  }, [timelineFrame.activeSectionIndex]);

  useEffect(() => {
    if (globalProgress <= 0.0001) {
      hasEnteredFirstSectionRef.current = false;
    }
  }, [globalProgress]);

  const updateIsAtStoryEnd = useCallback(() => {
    const container = containerRef.current;

    if (!container) {
      setIsAtStoryEnd(false);
      return;
    }

    const containerBottom = container.offsetTop + container.scrollHeight;
    const viewportBottom = window.scrollY + window.innerHeight;
    const reachedContainerEnd = viewportBottom >= containerBottom - END_SCROLL_CUE_HIDE_OFFSET_PX;
    const reachedProgressEnd = targetScrollRef.current >= END_SCROLL_CUE_HIDE_PROGRESS;
    const nextIsAtStoryEnd = reachedContainerEnd || reachedProgressEnd;

    setIsAtStoryEnd((previous) => (previous === nextIsAtStoryEnd ? previous : nextIsAtStoryEnd));
  }, []);

  const tick = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const rect = container.getBoundingClientRect();
    const containerTop = rect.top + window.scrollY;
    const containerHeight = container.scrollHeight - window.innerHeight;
    const rawProgress = (window.scrollY - containerTop) / Math.max(containerHeight, 1);
    targetScrollRef.current = Math.max(0, Math.min(1, rawProgress));
    const rawFrame = resolveStoryTimelineFrame(viewerStates, timeline, targetScrollRef.current);
    const nextDotSectionIndex = gestureLockRef.current
      ? targetSectionIndexRef.current
      : rawFrame.activeSectionIndex;
    setActiveDotSectionIndex((previous) => (
      previous === nextDotSectionIndex ? previous : nextDotSectionIndex
    ));
    updateIsAtStoryEnd();
    const motion = getViewportMotionSettings();

    const prev = smoothScrollRef.current;
    const next = gestureLockRef.current
      ? targetScrollRef.current
      : prev + (targetScrollRef.current - prev) * motion.smoothFactor;
    smoothScrollRef.current = next;

    const visualPrev = visualScrollRef.current;
    const visualNext = gestureLockRef.current
      ? next
      : visualPrev + (next - visualPrev) * motion.visualSmoothFactor;
    visualScrollRef.current = visualNext;

    // Only update React state when there's meaningful change
    if (Math.abs(next - prev) > 0.0001) {
      const frame = resolveStoryTimelineFrame(viewerStates, timeline, next);
      setTimelineFrame(frame);
      setGlobalProgress(next);
    }

    if (Math.abs(visualNext - visualPrev) > 0.0001) {
      const visualFrame = resolveStoryTimelineFrame(viewerStates, timeline, visualNext);
      setVisualTimelineFrame(visualFrame);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [timeline, updateIsAtStoryEnd, viewerStates]);

  useEffect(() => {
    const handleScroll = () => {
      updateIsAtStoryEnd();
    };

    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [updateIsAtStoryEnd]);

  const animateScrollToProgress = useCallback((targetProgress: number, sectionIndex: number) => {
    const container = containerRef.current;
    if (!container) return;

    const safeIndex = Math.max(0, Math.min(viewerStates.length - 1, sectionIndex));
    const clampedTargetProgress = Math.max(0, Math.min(1, targetProgress));
    const rect = container.getBoundingClientRect();
    const containerTop = rect.top + window.scrollY;
    const containerHeight = container.scrollHeight - window.innerHeight;
    const startY = window.scrollY;
    const targetY = containerTop + clampedTargetProgress * Math.max(containerHeight, 0);

    if (Math.abs(targetY - startY) < 1) return;

    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current);
    }

    gestureLockRef.current = true;
    targetSectionIndexRef.current = safeIndex;
    setActiveDotSectionIndex(safeIndex);
    if (safeIndex >= 0) {
      hasEnteredFirstSectionRef.current = true;
    }
    const motion = getViewportMotionSettings();
    const startedAt = performance.now() - 48;
    const startProgress = smoothScrollRef.current;
    const isForwardMotion = clampedTargetProgress > startProgress;
    const immediateProgressFactor = isForwardMotion
      ? motion.immediateProgressFactor * 0.72
      : motion.immediateProgressFactor;
    const minImmediateProgressDelta = isForwardMotion
      ? motion.minImmediateProgressDelta * 0.72
      : motion.minImmediateProgressDelta;
    const sectionScrollDurationMs = isForwardMotion
      ? motion.sectionScrollDurationMs * 1.4
      : motion.sectionScrollDurationMs;
    const immediateDelta = Math.max(
      Math.abs(clampedTargetProgress - startProgress) * immediateProgressFactor,
      minImmediateProgressDelta
    );
    const immediateProgress = clampedTargetProgress >= startProgress
      ? Math.min(clampedTargetProgress, startProgress + immediateDelta)
      : Math.max(clampedTargetProgress, startProgress - immediateDelta);

    if (Math.abs(immediateProgress - startProgress) > 0.0001) {
      smoothScrollRef.current = immediateProgress;
      visualScrollRef.current = immediateProgress;
      targetScrollRef.current = immediateProgress;

      const immediateFrame = resolveStoryTimelineFrame(viewerStates, timeline, immediateProgress);
      setTimelineFrame(immediateFrame);
      setVisualTimelineFrame(immediateFrame);
      setActiveDotSectionIndex(immediateFrame.activeSectionIndex);
      setGlobalProgress(immediateProgress);

      const immediateY = containerTop + immediateProgress * Math.max(containerHeight, 0);
      window.scrollTo({ top: immediateY, behavior: 'auto' });
    }

    const step = (now: number) => {
      const elapsed = now - startedAt;
      const ratio = Math.min(1, elapsed / sectionScrollDurationMs);
      const eased = easeOutCubic(ratio);
      const nextY = startY + (targetY - startY) * eased;
      window.scrollTo({ top: nextY, behavior: 'auto' });

      if (ratio < 1) {
        scrollAnimationRef.current = requestAnimationFrame(step);
        return;
      }

      window.scrollTo({ top: targetY, behavior: 'auto' });

      if (clampedTargetProgress <= INTRO_PROGRESS) {
        smoothScrollRef.current = INTRO_PROGRESS;
        visualScrollRef.current = INTRO_PROGRESS;
        targetScrollRef.current = INTRO_PROGRESS;
        hasEnteredFirstSectionRef.current = false;
        targetSectionIndexRef.current = 0;
        pendingDirectionRef.current = null;

        const introFrame = resolveStoryTimelineFrame(viewerStates, timeline, INTRO_PROGRESS);
        setTimelineFrame(introFrame);
        setVisualTimelineFrame(introFrame);
        setActiveDotSectionIndex(introFrame.activeSectionIndex);
        setGlobalProgress(INTRO_PROGRESS);
      }

      scrollAnimationRef.current = null;
      gestureLockRef.current = false;

      const pendingDirection = pendingDirectionRef.current;
      pendingDirectionRef.current = null;
      if (pendingDirection !== null) {
        const currentIndex = targetSectionIndexRef.current;
        const nextIndex = Math.max(0, Math.min(viewerStates.length - 1, currentIndex + pendingDirection));
        if (nextIndex !== currentIndex) {
          animateScrollToSection(nextIndex);
        }
      }
    };

    step(startedAt);
  }, [timeline, viewerStates]);

  const animateScrollToSection = useCallback((sectionIndex: number) => {
    const safeIndex = Math.max(0, Math.min(viewerStates.length - 1, sectionIndex));
    const targetProgress = sectionProgressStops[safeIndex] ?? 1;
    animateScrollToProgress(targetProgress, safeIndex);
  }, [animateScrollToProgress, sectionProgressStops, viewerStates.length]);

  const navigateSection = useCallback((direction: -1 | 1) => {
    if (viewerStates.length === 0) return;

    if (gestureLockRef.current) {
      const currentIndex = targetSectionIndexRef.current;

      if (direction < 0 && currentIndex === 0) {
        pendingDirectionRef.current = null;
        gestureLockRef.current = false;

        if (scrollAnimationRef.current !== null) {
          cancelAnimationFrame(scrollAnimationRef.current);
          scrollAnimationRef.current = null;
        }

        animateScrollToProgress(INTRO_PROGRESS, 0);
        return;
      }

      const nextIndex = Math.max(0, Math.min(viewerStates.length - 1, currentIndex + direction));

      if (nextIndex === currentIndex) return;

      pendingDirectionRef.current = null;
      gestureLockRef.current = false;

      if (scrollAnimationRef.current !== null) {
        cancelAnimationFrame(scrollAnimationRef.current);
        scrollAnimationRef.current = null;
      }

      animateScrollToSection(nextIndex);
      return;
    }

    if (direction < 0 && targetSectionIndexRef.current === 0 && globalProgress > 0.0001) {
      animateScrollToProgress(INTRO_PROGRESS, 0);
      return;
    }

    const currentIndex = direction > 0 && !hasEnteredFirstSectionRef.current
      ? (hasIntroSection ? 0 : -1)
      : targetSectionIndexRef.current;
    const nextIndex = Math.max(0, Math.min(viewerStates.length - 1, currentIndex + direction));
    if (nextIndex === currentIndex) return;

    animateScrollToSection(nextIndex);
  }, [animateScrollToProgress, animateScrollToSection, globalProgress, hasIntroSection, viewerStates.length]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (scrollAnimationRef.current !== null) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
      gestureLockRef.current = false;
      pendingDirectionRef.current = null;
    };
  }, [tick]);

  useEffect(() => {
    document.documentElement.classList.add('story-scroll-hidden');
    document.body.classList.add('story-scroll-hidden');
    return () => {
      document.documentElement.classList.remove('story-scroll-hidden');
      document.body.classList.remove('story-scroll-hidden');
    };
  }, []);

  useEffect(() => {
    return () => {
      if (backButtonTimeoutRef.current !== null) {
        window.clearTimeout(backButtonTimeoutRef.current);
      }

      if (wheelGestureTimeoutRef.current !== null) {
        window.clearTimeout(wheelGestureTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 0.5) return;

      event.preventDefault();

      const now = performance.now();
      lastWheelAtRef.current = now;

      if (wheelGestureTimeoutRef.current !== null) {
        window.clearTimeout(wheelGestureTimeoutRef.current);
      }

      wheelGestureTimeoutRef.current = window.setTimeout(() => {
        wheelGestureActiveRef.current = false;
        wheelGestureTimeoutRef.current = null;
      }, WHEEL_GESTURE_COOLDOWN_MS);

      if (wheelGestureActiveRef.current) {
        return;
      }

      wheelGestureActiveRef.current = true;
      navigateSection(event.deltaY > 0 ? 1 : -1);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      touchTriggeredRef.current = false;
      touchStartYRef.current = event.touches[0].clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (touchStartYRef.current === null || event.touches.length !== 1) return;

      const currentY = event.touches[0].clientY;
      const deltaY = currentY - touchStartYRef.current;

      if (Math.abs(deltaY) < TOUCH_GESTURE_THRESHOLD_PX) {
        event.preventDefault();
        return;
      }

      event.preventDefault();

      if (touchTriggeredRef.current) return;

      touchTriggeredRef.current = true;
      touchStartYRef.current = null;
      navigateSection(deltaY < 0 ? 1 : -1);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (touchTriggeredRef.current) {
        touchTriggeredRef.current = false;
        touchStartYRef.current = null;
        return;
      }

      const startY = touchStartYRef.current;
      touchStartYRef.current = null;
      if (startY === null) return;

      const endY = event.changedTouches[0]?.clientY ?? startY;
      const deltaY = endY - startY;
      if (Math.abs(deltaY) < TOUCH_GESTURE_THRESHOLD_PX) return;

      navigateSection(deltaY < 0 ? 1 : -1);
    };

    const handleTouchCancel = () => {
      touchStartYRef.current = null;
      touchTriggeredRef.current = false;
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [navigateSection]);

  const queueBackNavigation = useCallback(() => {
    if (backButtonTimeoutRef.current !== null) {
      window.clearTimeout(backButtonTimeoutRef.current);
    }

    setIsBackButtonPressed(true);
    backButtonTimeoutRef.current = window.setTimeout(() => {
      navigate('/');
    }, BACK_BUTTON_PRESS_FEEDBACK_MS);
  }, [navigate]);

  const titleTextStyle = story.titleTextStyle ?? {};
  const titleBoxStyle = story.titleTextStyle
    ? {
        backgroundColor: getBackgroundColor(titleTextStyle.backgroundColor),
        borderRadius: `${titleTextStyle.borderRadius ?? 8}px`,
        padding: `${titleTextStyle.padding ?? 24}px`,
        maxWidth: 'min(100%, 880px)',
      }
    : undefined;

  const activeCaption =
    timelineFrame.activeParagraphIndex === null
      ? undefined
      : story.paragraphs[timelineFrame.activeParagraphIndex]?.caption;
  const lastSectionIndex = viewerStates.length - 1;
  const isAtLastSection = lastSectionIndex >= 0 && (
    activeDotSectionIndex >= lastSectionIndex ||
    targetSectionIndexRef.current >= lastSectionIndex
  );
  const showScrollCue = viewerStates.length > 1 && !isAtStoryEnd && !isAtLastSection;

  return (
    <div ref={containerRef} className="relative" style={{ minHeight: '100vh' }}>
      <ScrollProgress />

      {/* Back button */}
      <Link
        to="/"
        aria-label="Back to stories"
        onPointerDown={() => setIsBackButtonPressed(true)}
        onPointerCancel={() => setIsBackButtonPressed(false)}
        onPointerLeave={() => setIsBackButtonPressed(false)}
        onClick={(event) => {
          event.preventDefault();
          queueBackNavigation();
        }}
        className="fixed left-6 top-1/2 -translate-y-1/2 z-50 flex h-12 w-12 items-center justify-center transition-transform duration-150 hover:scale-105 active:scale-95"
        style={{
          opacity: isBackButtonPressed ? 0.82 : 1,
        }}
      >
        <img
          src={backButtonImage}
          alt=""
          aria-hidden="true"
          className="h-10 w-10 object-contain select-none mr-8"
          draggable={false}
        />
      </Link>

      {/* Progress dots */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
        {viewerStates.map((state, i) => {
          const isActive = i === activeDotSectionIndex;
          return (
            <div
              key={state.id}
              className="h-1.5 w-1.5 rounded-full border transition-all duration-300"
              style={{
                background: isActive
                  ? 'hsl(38, 60%, 55%)'
                  : 'hsla(40, 4%, 85%, 0.30)',
                borderColor: 'hsl(38, 60%, 55%)',
                transform: isActive ? 'scale(1.5)' : 'scale(1)',
              }}
            />
          );
        })}
      </div>

      {/* VISUAL STAGE — pinned full viewport */}
      <div className="sticky top-0 h-screen w-full z-0">
        <VisualStage
          images={story.images}
          state={visualTimelineFrame.state}
          title={story.title}
          caption={activeCaption}
        />

        {/* Title overlay */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 pointer-events-none transition-opacity duration-150"
          style={{
            opacity: Math.max(0, 1 - globalProgress * 14),
            paddingLeft: '55px',
          }}
        >
          <div className="rounded-2xl" style={titleBoxStyle}>
            <h1
              className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-4"
              style={{ color: 'hsl(45, 20%, 97%)', textShadow: '0 2px 20px hsl(220 15% 10% / 0.6)' }}
            >
              {story.title}
            </h1>
            {story.subtitle ? (
              <p
                className="font-sans text-lg md:text-xl max-w-2xl"
                style={{ color: 'hsl(45, 10%, 75%)' }}
              >
                {story.subtitle}
              </p>
            ) : null}
          </div>
          <div
            className="mt-6 font-sans text-sm"
            style={{ color: 'hsl(45, 10%, 60%)' }}
          >
            {/* By {story.author} · {story.date} · {story.readTime} */}
          </div>
        </div>
      </div>

      {/* TEXT COLUMN — scrolls over the visual stage */}
      <TextColumn
        paragraphs={story.paragraphs}
        timeline={timeline}
        activeSectionIndex={timelineFrame.activeSectionIndex}
        activeParagraphIndex={timelineFrame.activeParagraphIndex}
        activePhase={timelineFrame.phase}
        activeParagraphProgress={timelineFrame.state.paragraphProgress}
      />

      {showScrollCue && (
        <button
          type="button"
          aria-label="Scroll to next section"
          // onClick={() => navigateSection(1)}
          className="scroll-indicator fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center justify-center bg-transparent transition-opacity"
          style={{
            WebkitTapHighlightColor: 'transparent',
            opacity: globalProgress <= 0.02 ? 1 : 0.92,
          }}
        >
          <img
            src={downIcon}
            alt=""
            aria-hidden="true"
            className="h-10 w-10 object-contain select-none"
            draggable={false}
          />
        </button>
      )}

      {/* End card */}
      {/* <div className="relative z-10 min-h-[50vh] flex items-center justify-center" style={{ background: 'hsl(220 15% 8%)' }}>
        <div className="text-center max-w-md p-8">
          <p className="story-caption mb-4" style={{ color: 'hsl(38, 60%, 55%)' }}>End of Story</p>
          <h3 className="font-serif text-2xl font-bold mb-4" style={{ color: 'hsl(45, 20%, 97%)' }}>
            {story.title}
          </h3>
          <p className="text-sm mb-6 font-sans" style={{ color: 'hsl(45, 10%, 55%)' }}>
            By {story.author} · {story.date}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md font-sans text-sm hover:opacity-90 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            More Stories
          </Link>
        </div>
      </div> */}
    </div>
  );
}
