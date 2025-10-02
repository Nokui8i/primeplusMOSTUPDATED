import { Timestamp } from 'firebase/firestore';

export interface Tip {
  id: string;                    // Firestore document ID (auto-generated)
  creatorId: string;             // UID of the creator receiving the tip
  tipperId: string;              // UID of the user giving the tip
  amount: number;                // Amount of the tip in the smallest currency unit (e.g., cents)
  currency: string;              // Currency code (e.g., "USD", "EUR")
  message?: string;              // Optional message from the tipper
  status: 'pending' | 'completed' | 'failed' | 'refunded'; // Status of the tip
  createdAt: Timestamp;          // When the tip was created
  updatedAt: Timestamp;          // When the tip was last updated
  refundReason?: string;         // Reason for refund if applicable
} 