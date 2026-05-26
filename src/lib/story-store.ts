import { demoStories } from './demo-data';
import type { Story } from './types';
import { uuid } from './utils';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { database, deleteStory } from '@/firebase/firebase';

const storiesCollection = collection(database, 'stories');

let stories: Story[] = [...demoStories];
let listeners: (() => void)[] = [];
let hasLoaded = false;

function notify() {
  listeners.forEach((listener) => listener());
}

async function loadStoriesFromFirebase() {
  try {
    const snapshot = await getDocs(storiesCollection);
    const loaded = snapshot.docs
      .map((docSnap) => docSnap.data() as Story)
      .filter((story): story is Story => Boolean(story && story.id && story.slug));

    if (loaded.length > 0) {
      stories = loaded;
    }
  } catch (error) {
    console.error('Failed to load stories from Firestore:', error);
  }

  hasLoaded = true;
  notify();
}

loadStoriesFromFirebase();

async function persistStoryToFirebase(story: Story) {
  try {
    await setDoc(doc(storiesCollection, story.id), story);
  } catch (error) {
    console.error('Failed to save story to Firestore:', error);
  }
}

export const storyStore = {
  subscribe(listener: () => void) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  getAll(): Story[] {
    return stories;
  },

  getPublished(): Story[] {
    return stories.filter((story) => story.status === 'published');
  },

  getBySlug(slug: string): Story | undefined {
    return stories.find((story) => story.slug === slug);
  },

  getById(id: string): Story | undefined {
    return stories.find((story) => story.id === id);
  },

  hasLoaded(): boolean {
    return hasLoaded;
  },

  save(story: Story) {
    const idx = stories.findIndex((item) => item.id === story.id);
    if (idx >= 0) {
      stories = stories.map((item) => (item.id === story.id ? story : item));
    } else {
      stories = [...stories, story];
    }
    hasLoaded = true;
    notify();
    persistStoryToFirebase(story);
  },

  delete(id: string) {
    stories = stories.filter((story) => story.id !== id);
    notify();
    deleteStory(id);
  },

  duplicate(id: string) {
    const story = stories.find((item) => item.id === id);
    if (!story) return;

    const newStory: Story = {
      ...story,
      id: uuid(),
      slug: `${story.slug}-copy`,
      title: `${story.title} (Copy)`,
      status: 'draft',
      states: story.states.map((state) => ({ ...state, id: uuid() })),
      paragraphs: story.paragraphs.map((paragraph) => ({ ...paragraph, id: uuid() })),
    };
    stories = [...stories, newStory];
    notify();
    persistStoryToFirebase(newStory);
  },

  reset() {
    stories = [...demoStories];
    hasLoaded = true;
    notify();
    stories.forEach((story) => persistStoryToFirebase(story));
  },
};
