import { demoStories } from './demo-data';
import type { Story } from './types';
import { uuid } from './utils';

// ── persist to public/data.json via Vite middleware ──────────────────────────
async function persistToFile(data: Story[]) {
  try {
    await fetch('/api/save-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    // dev server not available (e.g. production static build) — ignore
  }
}

// ── in-memory store ───────────────────────────────────────────────────────────
let stories: Story[] = [...demoStories]; // shown instantly while data.json loads
let listeners: (() => void)[] = [];
let hasLoaded = false;

function notify() {
  listeners.forEach((l) => l());
}

// Load from /data.json on startup — replaces demo data if real stories exist
fetch(`/data.json?t=${Date.now()}`)
  .then((r) => r.json())
  .then((parsed: Story[]) => {
    if (Array.isArray(parsed) && parsed.length > 0) {
      stories = parsed;
    }
    hasLoaded = true;
    notify();
  })
  .catch(() => {
    hasLoaded = true;
    notify();
  });

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
    return stories.filter((s) => s.status === 'published');
  },

  getBySlug(slug: string): Story | undefined {
    return stories.find((s) => s.slug === slug);
  },

  getById(id: string): Story | undefined {
    return stories.find((s) => s.id === id);
  },

  hasLoaded(): boolean {
    return hasLoaded;
  },

  save(story: Story) {
    const idx = stories.findIndex((s) => s.id === story.id);
    if (idx >= 0) {
      stories = stories.map((s) => (s.id === story.id ? story : s));
    } else {
      stories = [...stories, story];
    }
    hasLoaded = true;
    persistToFile(stories);
    notify();
  },

  delete(id: string) {
    stories = stories.filter((s) => s.id !== id);
    persistToFile(stories);
    notify();
  },

  duplicate(id: string) {
    const story = stories.find((s) => s.id === id);
    if (!story) return;
    const newStory: Story = {
      ...story,
      id: uuid(),
      slug: story.slug + '-copy',
      title: story.title + ' (Copy)',
      status: 'draft',
      states: story.states.map((s) => ({ ...s, id: uuid() })),
      paragraphs: story.paragraphs.map((p) => ({ ...p, id: uuid() })),
    };
    stories = [...stories, newStory];
    persistToFile(stories);
    notify();
  },

  reset() {
    stories = [...demoStories];
    hasLoaded = true;
    persistToFile(stories);
    notify();
  },
};
