import { Link } from 'react-router-dom';
import type { Story } from '@/lib/types';

interface Props {
  story: Story;
  featured?: boolean;
}

export function StoryCard({ story, featured }: Props) {
  if (featured) {
    return (
      <Link to={`/stories/${story.slug}`} className="group block">
        <div className="relative overflow-hidden rounded-sm aspect-[16/9]">
          <img
            src={story.coverImage}
            alt={story.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
            width={1920}
            height={1080}
          />
          <div className="story-overlay absolute inset-0" />
          <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 z-10">
            <span className="story-caption mb-3 block" style={{ color: 'hsl(38, 60%, 55%)' }}>
              Featured
            </span>
            <h2 className="story-headline text-3xl md:text-5xl mb-3" style={{ color: 'hsl(45, 20%, 97%)' }}>
              {story.title}
            </h2>
            <p className="font-sans text-base md:text-lg max-w-xl" style={{ color: 'hsl(45, 10%, 80%)' }}>
              {story.subtitle}
            </p>
            <div className="mt-4 flex items-center gap-3 text-sm font-sans" style={{ color: 'hsl(45, 10%, 65%)' }}>
              <span>{story.author}</span>
              <span>·</span>
              <span>{story.readTime}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/stories/${story.slug}`} className="group block">
      <div className="relative overflow-hidden rounded-md aspect-[16/11]">
        <img
          src={story.coverImage}
          alt={story.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <h3 className="absolute bottom-3 left-3 pr-3 story-headline text-[10px] font-normal leading-tight group-hover:text-accent transition-colors" style={{ color: 'hsl(45, 20%, 97%)' }}>
          {story.title}
        </h3>
      </div>
    </Link>
  );
}
