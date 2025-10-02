import { User } from './user.model';
import { Timestamp } from 'firebase-admin/firestore';

export interface UserSubscription {
  id: string;                    // Firestore document ID (auto-generated)
  creatorId: string;             // UID of the subscribed-to creator
  subscriberId: string;          // UID of the subscribing user
  planId: string;                // ID of the plan from the 'plans' collection
  status: 'active' | 'cancelled' | 'expired' | 'pending_payment' | 'free_trial'; // Status of this subscription
  startDate: Timestamp;          // When this specific plan subscription started or became active
  endDate?: Timestamp | null;    // When this specific plan subscription ends (for timed/paid plans, or if cancelled). Null for indefinite free plans.
  nextBillingDate?: Timestamp | null; // For recurring paid plans
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'refunded'; // Payment status
  cancellationReason?: string | null;
  cancelledAt?: Timestamp | null;
  createdAt: Timestamp;          // When the subscription document was created
  updatedAt: Timestamp;          // When the subscription document was last updated
  willRenew?: boolean;           // Indicates if the subscription will auto-renew (false if cancelled)
}

// Optional: If you need to return populated user objects with subscriptions
export interface PopulatedUserSubscription extends UserSubscription {
  subscriber?: User;
  subscribee?: User;
} 