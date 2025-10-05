/**
 * 🔒 PROTECTED TYPES - Post Data Structure
 * 
 * These types define the core data model. Modifications require:
 * 1. Explicit approval from the project maintainer
 * 2. Database migration plan
 * 3. Frontend component updates
 * 4. Documentation updates in CHANGELOG.md
 * 
 * Protected Types:
 * - Post interface
 * - Comment interface
 * - Like interface
 * - PostStats interface
 * 
 * Last Modified: 2024-04-22
 * Version: stable-v1.1
 */

import { Timestamp } from 'firebase/firestore';
import { UserProfile } from './user';
import { PostData } from '@/types'

export interface User {
  id: string
  displayName: string
  photoURL?: string
  username?: string
}

export type PostType = 'text' | 'image' | 'video' | 'live_stream' | 'vr' | 'image360' | 'video360' | 'ar' | 'audio'

export interface Post {
  // =============================================
  // 🔷 CORE POST PROPERTIES
  // =============================================
  id: string;
  content: string;
  mediaUrl?: string;
  mediaType?: PostType;
  thumbnailUrl?: string;
  background?: string;
  authorId: string;
  type: PostType;
  isPublic: boolean;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  likes: number;
  comments: number;
  shares: number;
  tags: string[];
  location?: string;
  taggedUsers: string[];
  commands?: string[];
  likedBy?: string[];
  
  // =============================================
  // 📊 ENHANCED METADATA
  // =============================================
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    fileSize?: number;
    mimeType?: string;
    aspectRatio?: string;
    quality?: string;
    format?: string;
    imageMetadata?: {
      isAnimated?: boolean;
      hasTransparency?: boolean;
      colorProfile?: string;
    };
    videoMetadata?: {
      codec?: string;
      bitrate?: number;
      fps?: number;
      hasAudio?: boolean;
    };
    audioMetadata?: {
      bitrate?: number;
      sampleRate?: number;
      channels?: number;
      duration?: number;
    };
    vrMetadata?: {
      format?: 'mono' | 'stereo';
      projection?: 'equirectangular' | 'cubemap';
      interactive?: boolean;
    };
  };

  // =============================================
  // 📈 ENGAGEMENT METRICS
  // =============================================
  engagement?: {
    views: number;
    uniqueViews: number;
    averageViewDuration?: number;
    clickThroughRate?: number;
    saveCount: number;
    reportCount: number;
    relevanceScore?: number;
  };

  // =============================================
  // 🛡️ CONTENT MODERATION
  // =============================================
  moderation?: {
    isFlagged: boolean;
    flaggedBy?: string[];
    reviewStatus?: 'pending' | 'approved' | 'rejected';
    reviewNotes?: string;
    lastReviewedAt?: Timestamp;
    lastReviewedBy?: string;
  };

  // =============================================
  // 📂 CONTENT ORGANIZATION
  // =============================================
  organization?: {
    category?: string;
    subcategory?: string;
    collections?: string[];
    featuredIn?: string[];
    priority?: number;
    expiryDate?: Timestamp;
  };

  // =============================================
  // 🎮 VR/360 SPECIFIC FIELDS
  // =============================================
  vrSettings?: {
    isInteractive: boolean;
    environmentType?: string;
    controls?: string[];
    hotspots?: Array<{
      position: { x: number; y: number; z: number };
      type: string;
      content?: string;
    }>;
  };

  // =============================================
  // 📱 STORY SPECIFIC FIELDS
  // =============================================
  storySettings?: {
    duration: number;
    musicUrl?: string;
    effects?: string[];
    stickers?: Array<{
      type: string;
      position: { x: number; y: number };
      rotation?: number;
    }>;
  };

  // =============================================
  // 🔐 CONTENT ACCESS SETTINGS
  // =============================================
  accessSettings?: {
    isPremium: boolean;
    subscriptionTier?: string;
    price?: number;
    promoCode?: string;
    accessLevel?: 'free' | 'premium' | 'exclusive' | 'followers';
    availableFrom?: Timestamp;
    availableUntil?: Timestamp;
    geoRestrictions?: string[];
    ageRestriction?: number;
  };

  // =============================================
  // 📊 ANALYTICS TRACKING
  // =============================================
  analytics?: {
    source?: string;
    campaign?: string;
    referrer?: string;
    deviceInfo?: {
      type?: string;
      os?: string;
      browser?: string;
    };
    performance?: {
      loadTime?: number;
      renderTime?: number;
      interactionTime?: number;
    };
  };

  // Live stream specific fields
  streamId?: string;
  title?: string;
  viewerCount?: number;
  status?: 'live' | 'ended';

  showWatermark?: boolean;
}

// =============================================
// 💬 COMMENT INTERFACE
// =============================================
export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  author: {
    displayName: string;
    username: string;
    photoURL?: string;
  };
  content: string;
  likes: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// =============================================
// ❤️ LIKE INTERFACE
// =============================================
export interface Like {
  id: string;
  postId: string;
  userId: string;
  createdAt: Timestamp;
}

// =============================================
// 👤 POST WITH AUTHOR INTERFACE
// =============================================
export interface PostWithAuthor extends Omit<PostData, 'comments'> {
  title: string
  authorName: string
  author: User
  type: PostType
  isPublic: boolean
  shares: number
  taggedUsers: string[]
  comments: number
  accessSettings?: {
    isPremium: boolean;
    subscriptionTier?: string;
    price?: number;
    promoCode?: string;
    accessLevel?: 'free' | 'premium' | 'exclusive' | 'followers';
    availableFrom?: Timestamp;
    availableUntil?: Timestamp;
    geoRestrictions?: string[];
    ageRestriction?: number;
  };
} 