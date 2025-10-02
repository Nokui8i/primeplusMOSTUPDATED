import { Timestamp, FieldValue } from 'firebase/firestore';

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
  role: 'user' | 'creator' | 'admin' | 'superadmin' | 'owner';
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatorProfile extends UserProfile {
  bio?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    website?: string;
  };
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  mediaUrl?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Like {
  userId: string;
  postId: string;
  createdAt: Timestamp | FieldValue;
} 