import { useSyncExternalStore } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { storyStore } from '@/lib/story-store';
import { StoryViewer } from '@/components/story/StoryViewer';

export default function StoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const story = useSyncExternalStore(
    storyStore.subscribe,
    () => (slug ? storyStore.getBySlug(slug) : undefined),
  );
  const hasLoaded = useSyncExternalStore(
    storyStore.subscribe,
    () => storyStore.hasLoaded(),
  );

  if (!hasLoaded && !story) {
    return null;
  }

  if (!story || story.paragraphs.length === 0) {
    return <Navigate to="/" replace />;
  }

  return <StoryViewer story={story} />;
}
