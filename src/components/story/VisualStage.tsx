import { memo } from 'react';

interface Props {
  images: string[];
  state: {
    imageIndex: number;
    nextImageIndex: number | null;
    imageCrossfade: number;
    scale: number;
    x: number;
    y: number;
  };
  title: string;
  caption?: string;
  fitMode?: 'contain' | 'cover';
}

export const VisualStage = memo(function VisualStage({ images, state, title, caption, fitMode = 'cover' }: Props) {
  const { imageIndex, nextImageIndex, imageCrossfade, scale, x, y } = state;

  const currentTransform = `translate3d(${-scale * x}%, ${-scale * y}%, 0) scale(${scale})`;

  return (
    <div className="absolute inset-0 overflow-hidden bg-foreground/5">
      {/* Current image */}
      <div
        className="absolute inset-0 will-change-transform"
        style={{
          transform: currentTransform,
          transformOrigin: 'center center',
          transition: 'transform 220ms linear',
        }}
      >
        <img
          src={images[imageIndex] || ''}
          alt={title}
          className={`w-full h-full ${fitMode === 'contain' ? 'object-contain' : 'object-cover'}`}
          draggable={false}
        />
      </div>

      {/* Next image (crossfade) */}
      {nextImageIndex !== null && (
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: currentTransform,
            opacity: imageCrossfade,
            transition: 'transform 220ms linear',
          }}
        >
          <img
            src={images[nextImageIndex] || ''}
            alt={title}
            className={`w-full h-full ${fitMode === 'contain' ? 'object-contain' : 'object-cover'}`}
            draggable={false}
          />
        </div>
      )}


      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, hsl(220 15% 10% / 0.3) 100%)',
        }}
      />

      {/* Caption */}
      {caption && (
        <div className="absolute bottom-6 right-6 z-10">
          <span
            className="text-xs font-sans tracking-wide uppercase px-3 py-1.5 rounded-sm"
            style={{
              color: 'hsl(45, 20%, 80%)',
              background: 'hsl(220 15% 10% / 0.6)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {caption}
          </span>
        </div>
      )}
    </div>
  );
});

