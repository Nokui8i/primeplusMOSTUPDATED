import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  nickname?: string;
  createdAt: Timestamp;
  lastLogin: Timestamp;
  role: 'user' | 'creator' | 'admin';
  isActive: boolean;
  isPrivate: boolean;
  emailVerified: boolean;
  authProvider: 'email' | 'google';
  profileCompleted: boolean;
  metadata: {
    lastSignInTime: string;
    creationTime: string;
  };
}

export interface UserProfile {
  id: string;              // Firebase Auth UID
  username: string;        // Unique username
  email: string;          // User's email
  displayName?: string;    // Display name
  photoURL?: string;      // Profile photo URL
  role: 'user' | 'creator' | 'admin';
  isVerified: boolean;    // Creator verification status
  bio?: string;           // User biography
  location?: string;      // User location
  website?: string;       // User website
  socialLinks?: {         // Social media links
    twitter?: string;
    instagram?: string;
    youtube?: string;
  };
  stats?: {              // User statistics
    followers: number;
    following: number;
    posts: number;
    engagement: number;  // Engagement rate (0-1)
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
} 