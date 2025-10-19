import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: Date;
  updatedAt: Date;
  role: 'user' | 'admin';
  bio: string;
  website: string;
  location: string;
  followers: string[];
  following: string[];
  username: string;
  isVerified: boolean;
}

export interface UserPrivacySettings {
  showActivityStatus?: boolean;
  allowTagging?: boolean;
  allowProfileDiscovery?: boolean;
  [key: string]: any;
}

export interface UserProfile {
  uid: string;
  id: string;
  email: string;
  username: string;
  displayName: string;
  photoURL?: string;
  coverPhotoUrl?: string;
  isAgeVerified: boolean;
  isVerified: boolean;
  role: 'user' | 'creator' | 'admin';
  status: 'active' | 'suspended' | 'deleted';
  bio?: string;
  location?: string;
  website?: string;
  defaultSubscriptionPlanId?: string | null;
  defaultSubscriptionType?: 'free' | 'paid' | null;
  blockedUsers?: string[]; // Array of blocked user IDs
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
  };
  stats?: {
    followers: number;
    following: number;
    posts: number;
    engagement: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  privacy?: UserPrivacySettings;
}

export const createDefaultUser = (partial: Partial<User>): User => ({
  id: '',
  uid: '',
  displayName: '',
  email: '',
  photoURL: '/default-avatar.png',
  createdAt: new Date(),
  updatedAt: new Date(),
  role: 'user',
  bio: '',
  website: '',
  location: '',
  followers: [],
  following: [],
  username: '',
  isVerified: false,
  ...partial
}); 