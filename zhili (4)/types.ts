

export enum AppView {
  GENERATE = 'GENERATE',
  EDIT = 'EDIT',
  EXTRACT = 'EXTRACT',
  GALLERY = 'GALLERY',
  INSPIRATION = 'INSPIRATION',
  ENHANCE = 'ENHANCE'
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  model: string;
}

// Added missing InspirationItem interface
export interface InspirationItem {
  uri: string;
  title: string;
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
export type ImageSize = '1K' | '2K' | '4K';

declare global {
  /**
   * Define AIStudio interface globally to match platform-level declarations
   * and resolve type mismatch errors in window augmentation.
   */
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  /**
   * Augmenting the Window interface to include aistudio.
   */
  interface Window {
    /**
     * Re-added 'readonly' modifier to fix the "All declarations of 'aistudio' must have identical modifiers" error.
     * Interface merging requires consistent modifiers across all global declarations of the Window interface.
     */
    readonly aistudio: AIStudio;
  }
}