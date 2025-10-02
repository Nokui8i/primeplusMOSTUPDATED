export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  photoURL?: string;
  isAgeVerified: boolean;
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

export interface Subscription {
  id: string;
  subscriberId: string;
  creatorId: string;
  tier?: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'active' | 'cancelled' | 'expired';
}

export interface Like {
  userId: string;
  postId: string;
  createdAt: Date;
} 