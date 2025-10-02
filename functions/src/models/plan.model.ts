import { Timestamp } from 'firebase-admin/firestore';

export interface Plan {
  id: string;                     // Firestore document ID (auto-generated)
  creatorId: string;              // UID of the creator who owns this plan
  name: string;                   // e.g., "Basic Access (Free)", "Supporter Tier", "VIP Pass"
  description?: string;            // What this plan offers
  price: number;                  // Cost of the plan (e.g., in cents or smallest currency unit). 0 for a free plan.
  currency: string;               // e.g., "USD", "EUR"
  billingInterval?: 'day' | 'week' | 'month' | 'year' | null; // How often the plan renews. Null if free/indefinite or one-time.
  intervalCount?: number | null;     // e.g., 1 for every month/year. Relevant if billingInterval is set.
  features?: string[];             // List of benefits or features included in the plan
  isActive: boolean;              // If the plan is currently offered by the creator
  // isDefault?: boolean;          // Could be used to mark a creator's primary plan, though defaultSubscriptionPlanId on User might be better.
  // type: 'free' | 'paid';       // Can be inferred from price > 0
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Type for data used when creating or updating a plan
export type PlanData = Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>; 