export type PostType = 'image' | 'video' | 'image360' | 'video360' | 'vr' | 'ar';

export interface Hotspot {
  position: string;
  rotation?: string;
  text: string;
}

export interface MediaDimensions {
  width: number;
  height: number;
  aspectRatio: number;
} 