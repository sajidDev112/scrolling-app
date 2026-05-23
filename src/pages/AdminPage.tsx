import { useState, useSyncExternalStore } from 'react';
import { storyStore } from '@/lib/story-store';
import type { Story } from '@/lib/types';
import { uuid } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Plus, Copy, Trash2 } from 'lucide-react';
import { StoryEditor } from '@/components/admin/StoryEditor';
import mapLogo from '@/assets/MapLogo.png';

function useStories() {
  return useSyncExternalStore(storyStore.subscribe, storyStore.getAll);
}

export default function AdminPage() {
  const stories = useStories();
  const [editingStory, setEditingStory] = useState<Story | null>(null);

  const createNew = () => {
    const newStory: Story = {
      id: uuid(),
      slug: `story-${Date.now()}`,
      title: 'New Story',
      subtitle: '',
      coverImage: '',
      author: '',
      date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      readTime: '5 min read',
      status: 'draft',
      images: [],
      states: [],
      paragraphs: [],
    };
    storyStore.save(newStory);
    setEditingStory(newStory);
  };

  if (editingStory) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <StoryEditor story={editingStory} onClose={() => setEditingStory(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 grid grid-cols-3 items-center">
          {/* Left — New Story button */}
          <div className="flex items-center">
            <button onClick={createNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-sans hover:opacity-90">
              <Plus className="w-4 h-4" /> New Story
            </button>
          </div>

          {/* Center — title */}
          <div className="flex justify-center">
            <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-foreground whitespace-nowrap">
              Admin
            </h1>
          </div>

          {/* Right — logo */}
          <div className="flex justify-end">
            <Link to="/">
              <img src={mapLogo} alt="MAP Logo" className="h-10 md:h-12 w-auto object-contain" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {stories.map((story) => (
            <div
              key={story.id}
              className="group border border-border rounded-md overflow-hidden hover:border-accent/50 transition-colors bg-card"
            >
              <div
                className="relative aspect-[16/10] bg-muted cursor-pointer overflow-hidden"
                onClick={() => setEditingStory(story)}
              >
                {story.coverImage ? (
                  <img
                    src={story.coverImage}
                    alt={story.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm font-sans">
                    No cover
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
              <div className="p-3">
                <h3
                  className="font-serif font-semibold text-sm truncate cursor-pointer hover:text-accent transition-colors"
                  onClick={() => setEditingStory(story)}
                >
                  {story.title}
                </h3>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground font-sans">
                  <span
                    className={`px-2 py-0.5 rounded-full ${
                      story.status === 'published'
                        ? 'bg-accent/15 text-accent'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {story.status}
                  </span>
                  <span>{story.states.length} states</span>
                </div>
                <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-border">
                  <button
                    onClick={() => storyStore.duplicate(story.id)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-md"
                    title="Duplicate"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => storyStore.delete(story.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded-md"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
