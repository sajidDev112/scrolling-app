export interface StoryOverlay {
  type: 'highlight';
  shape: 'circle' | 'rect';
  /** Normalized coordinates [0-1] relative to image */
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  color?: string;
}

export interface VisualState {
  id: string;
  /** Which image to show (index into story.images) */
  imageIndex: number;
  zoom: {
    scale: number;
    x: number; // percent offset from center
    y: number;
  };
  overlays: StoryOverlay[];
  /** Easing for transitions into this state */
  easing?: 'linear' | 'ease-in-out' | 'ease-out';
}

export interface ParagraphTextStyle {
  backgroundColor?: string; // hex or rgba
  borderRadius?: number;    // px
  padding?: number;         // px
}

export interface ParagraphTextPosition {
  /** Vertical offset inside the crop frame, from its top edge */
  topPercent: number;
}

export interface StoryParagraph {
  id: string;
  text: string;
  /** Which visual state this paragraph triggers */
  stateId: string;
  /** Optional caption shown on the visual stage */
  caption?: string;
  /** Per-paragraph text styling */
  textStyle?: ParagraphTextStyle;
  /** Per-paragraph placement inside the cropped frame */
  textPosition?: ParagraphTextPosition;
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  coverImage: string;
  author: string;
  date: string;
  readTime: string;
  featured?: boolean;
  status: 'draft' | 'published';
  /** Optional style for the title/subtitle banner on the intro page */
  titleTextStyle?: ParagraphTextStyle;
  /** High-resolution images used in the visual stage */
  images: string[];
  /** Ordered visual states driven by scroll */
  states: VisualState[];
  /** Text paragraphs that drive the timeline */
  paragraphs: StoryParagraph[];
}
