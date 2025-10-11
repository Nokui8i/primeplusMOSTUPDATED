import { Timestamp } from 'firebase/firestore';

export interface Tip {
  id: string;                    // Firestore document ID (auto-generated)
  creatorId: string;             // UID of the creator receiving the tip
  tipperId: string;              // UID of the user giving the tip
  amount: number;                // Amount of the tip in dollars (e.g., 5.00)
  currency: string;              // Currency code (e.g., "USD", "EUR")
  message?: string;              // Optional message from the tipper
  status: 'completed';           // Status (no payment processing, always completed)
  context?: {                    // Context of where the tip was given
    type: 'post' | 'live' | 'message' | 'profile';
    id?: string;                 // ID of the post, stream, or message
    mediaType?: 'image' | 'video'; // If tipping on media in messages
  };
  createdAt: Timestamp;          // When the tip was created
  updatedAt: Timestamp;          // When the tip was last updated
}

export interface TipStats {
  totalTips: number;
  totalAmount: number;
  tipCount: number;
  recentTips: Tip[];
}

