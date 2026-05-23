import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { storyStore } from '@/lib/story-store';
import { StoryCard } from '@/components/StoryCard';
import { Link } from 'react-router-dom';
import downIcon from '@/assets/down_icon.png';
import homeIcon from '@/assets/home_icon.png';
import mapLogo from '@/assets/MapLogo.png';
import patternImage from '@/assets/pattern.png';

const INITIAL_VISIBLE_CARD_ROWS = 4;
const INITIAL_VISIBLE_CARD_COUNT = 12;
const CARD_GRID_GAP_PX = 16;
const CARD_CUE_SCROLL_DURATION_MS = 900;

const Index = () => {
  const allStories = useSyncExternalStore(storyStore.subscribe, storyStore.getAll);
  const stories = allStories.filter((s) => s.status === 'published');
  const cardsScrollRef = useRef<HTMLDivElement>(null);
  const firstCardRef = useRef<HTMLDivElement>(null);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const [visibleCardWindowHeight, setVisibleCardWindowHeight] = useState<number | null>(null);
  const [isCardScrollAtEnd, setIsCardScrollAtEnd] = useState(false);
  const hasMoreCardsThanInitialWindow = stories.length > INITIAL_VISIBLE_CARD_COUNT;

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
      if (scrollAnimationFrameRef.current !== null) {
        cancelAnimationFrame(scrollAnimationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasMoreCardsThanInitialWindow) {
      setVisibleCardWindowHeight(null);
      setIsCardScrollAtEnd(false);
      return;
    }

    const measureVisibleCardWindow = () => {
      const firstCard = firstCardRef.current;
      if (!firstCard) {
        return;
      }

      const nextVisibleHeight =
        firstCard.offsetHeight * INITIAL_VISIBLE_CARD_ROWS +
        CARD_GRID_GAP_PX * (INITIAL_VISIBLE_CARD_ROWS - 1);

      setVisibleCardWindowHeight(nextVisibleHeight);

      const cardsScrollContainer = cardsScrollRef.current;
      if (cardsScrollContainer) {
        const isAtEnd =
          cardsScrollContainer.scrollTop + cardsScrollContainer.clientHeight >=
          cardsScrollContainer.scrollHeight - 1;
        setIsCardScrollAtEnd(isAtEnd);
      }
    };

    measureVisibleCardWindow();

    const resizeObserver = new ResizeObserver(() => {
      measureVisibleCardWindow();
    });

    if (firstCardRef.current) {
      resizeObserver.observe(firstCardRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [hasMoreCardsThanInitialWindow, stories.length]);

  useEffect(() => {
    if (!hasMoreCardsThanInitialWindow || visibleCardWindowHeight === null) {
      return;
    }

    const cardsScrollContainer = cardsScrollRef.current;
    if (!cardsScrollContainer) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const isAtEnd =
        cardsScrollContainer.scrollTop + cardsScrollContainer.clientHeight >=
        cardsScrollContainer.scrollHeight - 1;
      setIsCardScrollAtEnd(isAtEnd);
    });

    return () => cancelAnimationFrame(frame);
  }, [hasMoreCardsThanInitialWindow, visibleCardWindowHeight, stories.length]);

  const animateCardsScrollBy = (distance: number) => {
    const cardsScrollContainer = cardsScrollRef.current;
    if (!cardsScrollContainer) {
      return;
    }

    if (scrollAnimationFrameRef.current !== null) {
      cancelAnimationFrame(scrollAnimationFrameRef.current);
    }

    const startScrollTop = cardsScrollContainer.scrollTop;
    const targetScrollTop = startScrollTop + distance;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / CARD_CUE_SCROLL_DURATION_MS, 1);
      const easedProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      cardsScrollContainer.scrollTop = startScrollTop + (targetScrollTop - startScrollTop) * easedProgress;

      if (progress < 1) {
        scrollAnimationFrameRef.current = requestAnimationFrame(step);
      } else {
        scrollAnimationFrameRef.current = null;
      }
    };

    scrollAnimationFrameRef.current = requestAnimationFrame(step);
  };

  const handleCardCueClick = () => {
    if (!hasMoreCardsThanInitialWindow) {
      return;
    }

    const cardsScrollContainer = cardsScrollRef.current;
    if (!cardsScrollContainer) {
      return;
    }

    animateCardsScrollBy(cardsScrollContainer.clientHeight);
  };

  const handleCardsScroll = () => {
    const cardsScrollContainer = cardsScrollRef.current;
    if (!cardsScrollContainer) {
      return;
    }

    const isAtEnd =
      cardsScrollContainer.scrollTop + cardsScrollContainer.clientHeight >=
      cardsScrollContainer.scrollHeight - 1;

    setIsCardScrollAtEnd(isAtEnd);
  };

  return (
    <div
      className="h-screen overflow-hidden bg-background flex flex-col"
      style={{
        backgroundImage: `url(${patternImage})`,
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat-y',
        backgroundSize: '100% 105%',
      }}
    >
      <Link
        onClick={() => window?.ipcRenderer?.send("QuitInfiniteScroll", {quite:"Quit"})}
        aria-label="Home"
        className="fixed left-[1.5%] top-1/2 -translate-y-1/2 z-50 flex items-center justify-center bg-transparent transition-colors"
        style={{
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <img src={homeIcon} alt="" aria-hidden="true" className="h-10 w-10 object-contain" />
      </Link>

      {/* Header */}
      <header className="shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-col items-center text-center gap-4">
          <div className="mt-12 flex justify-center">
            <img src={mapLogo} alt="MAP Logo" className="w-56 md:w-72 h-auto object-contain" />
          </div>

          <div className="flex justify-center">
            <h1 className="font-serif text-[36px] font-bold tracking-tight text-foreground whitespace-nowrap">
              Infinite Scroll
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto flex-1 min-h-0 py-12 px-16 sm:px-20 md:px-24 mt-12">
        {/* Story Grid — 1 col on mobile, 2 on tablet, 3 on desktop */}
        {stories.length > 0 && (
          <section className="flex h-full min-h-0 flex-col">
            {/* <h2 className="font-serif text-[28px] font-bold tracking-tight mb-8 shrink-0">
              <span className="mr-5 font-bold">|</span>
              Select the experience
            </h2> */}
            <div
              className="relative shrink-0"
              style={
                hasMoreCardsThanInitialWindow && visibleCardWindowHeight !== null
                  ? { height: `${visibleCardWindowHeight}px` }
                  : visibleCardWindowHeight !== null
                    ? { height: `${visibleCardWindowHeight}px` }
                    : undefined
              }
            >
              <div
                ref={cardsScrollRef}
                className="scrollbar-hidden grid h-full min-h-0 grid-cols-3 gap-4 overflow-y-auto pr-2"
                onScroll={handleCardsScroll}
              >
                {stories.map((story, index) => (
                  <div key={story.id} ref={index === 0 ? firstCardRef : undefined}>
                    <StoryCard story={story} />
                  </div>
                ))}
              </div>
            </div>
          

            {hasMoreCardsThanInitialWindow && !isCardScrollAtEnd && (
              <button
                type="button"
                aria-label="Show more stories"
                onClick={handleCardCueClick}
                className="scroll-indicator fixed bottom-[200px] left-1/2 z-40 flex -translate-x-1/2 items-center justify-center bg-transparent transition-colors"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <img src={downIcon} alt="" aria-hidden="true" className="h-10 w-10 object-contain" />
              </button>
            )}
          </section>
        )}

        {stories.length === 0 && (
          <div className="flex h-full items-center justify-center text-center py-24">
            <div>
            <p className="text-muted-foreground font-sans">No published stories yet.</p>
            <Link to="/admin" className="text-accent hover:underline font-sans text-sm mt-2 inline-block">
              Create your first story →
            </Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      {/* <footer className="border-t border-border mt-24">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center">
          <p className="text-xs text-muted-foreground font-sans">
            Chronicle · Immersive Storytelling Platform
          </p>
        </div>
      </footer> */}
    </div>
  );
};

export default Index;
