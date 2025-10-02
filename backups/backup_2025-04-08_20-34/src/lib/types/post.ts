import { Timestamp } from 'firebase/firestore';
import { UserProfile } from './user';

export interface Post {
  id: string;
  authorId: string;
  author?: Pick<UserProfile, 'displayName' | 'username' | 'photoURL' | 'isVerified'>;
  title?: string;
  content: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  type: 'text' | 'image' | 'video' | 'vr' | '360';
  isPublic: boolean;
  isPremium: boolean;
  likes: number;
  comments: number;
  shares: number;
  tags?: string[];
  location?: {
    name: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    fileSize?: number;
    mimeType?: string;
  };
  stats?: {
    views: number;
    uniqueViews: number;
    engagement: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
} 