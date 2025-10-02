"use strict";
// Service layer for subscription logic
// This will contain functions to interact with the database for subscriptions
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubscription = createSubscription;
exports.getSubscriptionById = getSubscriptionById;
exports.getActiveSubscriptionToCreator = getActiveSubscriptionToCreator;
exports.getSubscriptionsBySubscriber = getSubscriptionsBySubscriber;
exports.getSubscribersForCreator = getSubscribersForCreator;
exports.cancelSubscription = cancelSubscription;
exports.getLatestSubscriptionToCreator = getLatestSubscriptionToCreator;
// Example (to be implemented):
// import { UserSubscription } from '../models/subscription.model';
// import { getDbPool } from '../db/pg.client'; // Assuming a pg.client.ts for db connection
// export async function createSubscription(subscriberId: string, subscribeeId: string): Promise<UserSubscription> {
//   const pool = getDbPool();
//   // ... database insertion logic ...
//   return {} as UserSubscription; // Placeholder
// }
// export async function deleteSubscription(subscriberId: string, subscribeeId: string): Promise<void> {
//   // ... database deletion logic ...
// }
// export async function getFollowers(userId: string): Promise<string[]> {
//   // ... database query logic ...
//   return [];
// }
// export async function getFollowing(userId: string): Promise<string[]> {
//   // ... database query logic ...
//   return [];
// }
const admin = __importStar(require("firebase-admin"));
// Function to get Firestore instance, ensuring app is initialized
const getDb = () => {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
    return admin.firestore();
};
// Use the getter function to initialize db and collections
const db = getDb();
const subscriptionsCollection = () => db.collection('subscriptions');
const usersCollection = () => db.collection('users'); // Added for consistency if needed
const plansCollection = () => db.collection('plans');
/**
 * Creates a new subscription when a user subscribes to a creator's plan.
 * Assumes planId is validated and payment (if any) is handled before this call for paid plans.
 * @param subscriberId The UID of the user subscribing.
 * @param creatorId The UID of the creator being subscribed to.
 * @param planId The ID of the plan the user is subscribing to.
 * @param promoCode Optional promo code to apply.
 * @param isBundle Optional flag to indicate if this is a bundle purchase
 * @returns The created subscription document.
 * @throws Error if the plan does not exist, is not active, or does not belong to the creator.
 */
async function createSubscription(subscriberId, creatorId, planId, promoCode, isBundle) {
    // Validate the plan
    const planDoc = await plansCollection().doc(planId).get();
    if (!planDoc.exists) {
        throw new Error('Plan not found.');
    }
    const plan = { id: planDoc.id, ...planDoc.data() };
    if (plan.creatorId !== creatorId) {
        throw new Error('Plan does not belong to the specified creator.');
    }
    if (!plan.isActive) {
        throw new Error('The selected plan is not active.');
    }
    if (subscriberId === creatorId) {
        throw new Error('Cannot subscribe to your own plan.');
    }
    const existingActiveSub = await subscriptionsCollection()
        .where('subscriberId', '==', subscriberId)
        .where('creatorId', '==', creatorId)
        .where('status', '==', 'active') // Check for any active subscription to the creator
        .limit(1)
        .get();
    if (!existingActiveSub.empty) {
        throw new Error('User is already actively subscribed to this creator.');
    }
    // Promo code logic
    let appliedPromo = null;
    let finalPrice = plan.price;
    if (promoCode) {
        const promoSnap = await db.collection('promoCodes')
            .where('code', '==', promoCode)
            .where('isActive', '==', true)
            .where('applicablePlanIds', 'array-contains', planId)
            .limit(1)
            .get();
        if (promoSnap.empty) {
            throw new Error('Invalid or inactive promo code.');
        }
        const promo = promoSnap.docs[0].data();
        const now = new Date();
        if (promo.expiresAt && promo.expiresAt.toDate() < now) {
            throw new Error('Promo code expired.');
        }
        appliedPromo = {
            code: promo.code,
            discountPercent: promo.discountPercent,
            promoId: promoSnap.docs[0].id,
        };
        finalPrice = +(plan.price * (1 - promo.discountPercent / 100)).toFixed(2);
    }
    const now = admin.firestore.Timestamp.now();
    let endDate = null;
    let nextBillingDate = null;
    let isRecurring = true;
    if (isBundle) {
        // For bundles: one-time, non-renewing, no nextBillingDate
        isRecurring = false;
        nextBillingDate = null;
        // endDate should be set based on the bundle duration (handled by plan.intervalCount)
    }
    else if (plan.price > 0 && plan.billingInterval && plan.intervalCount) {
        // Recurring plan logic
        const startDate = new Date(now.toDate().getTime());
        if (plan.billingInterval === 'month') {
            endDate = admin.firestore.Timestamp.fromDate(new Date(startDate.setMonth(startDate.getMonth() + plan.intervalCount)));
            nextBillingDate = admin.firestore.Timestamp.fromDate(new Date(startDate.setMonth(startDate.getMonth() + plan.intervalCount)));
        }
        else if (plan.billingInterval === 'year') {
            endDate = admin.firestore.Timestamp.fromDate(new Date(startDate.setFullYear(startDate.getFullYear() + plan.intervalCount)));
            nextBillingDate = admin.firestore.Timestamp.fromDate(new Date(startDate.setFullYear(startDate.getFullYear() + plan.intervalCount)));
        }
    }
    const subscriptionId = `${subscriberId}_${creatorId}`;
    const newSubscriptionRef = subscriptionsCollection().doc(subscriptionId);
    const newSubscriptionData = {
        id: newSubscriptionRef.id,
        subscriberId,
        creatorId,
        planId,
        status: 'active',
        startDate: now,
        endDate: endDate,
        nextBillingDate: nextBillingDate,
        isBundle: !!isBundle,
        isRecurring: isRecurring,
        createdAt: now,
        updatedAt: now,
        ...(appliedPromo && { promoCode: appliedPromo.code, promoDiscountPercent: appliedPromo.discountPercent, promoId: appliedPromo.promoId, finalPrice }),
    };
    await newSubscriptionRef.set(newSubscriptionData);
    return newSubscriptionData;
}
/**
 * Retrieves a specific subscription by its ID.
 * @param subscriptionId The ID of the subscription.
 * @returns The subscription object or null if not found.
 */
async function getSubscriptionById(subscriptionId) {
    const doc = await subscriptionsCollection().doc(subscriptionId).get();
    if (!doc.exists) {
        return null;
    }
    return { id: doc.id, ...doc.data() };
}
/**
 * Retrieves an active subscription a user has with a specific creator.
 * Useful to check current subscription status or tier before allowing certain actions.
 * @param subscriberId UID of the subscriber.
 * @param creatorId UID of the creator.
 * @returns The active UserSubscription or null if none found.
 */
async function getActiveSubscriptionToCreator(subscriberId, creatorId) {
    const snapshot = await subscriptionsCollection()
        .where('subscriberId', '==', subscriberId)
        .where('creatorId', '==', creatorId)
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
    if (snapshot.empty) {
        return null;
    }
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}
/**
 * Lists all subscriptions for a given subscriber.
 * @param subscriberId The UID of the subscriber.
 * @param status Optional status to filter by (e.g., 'active').
 * @returns An array of user subscriptions.
 */
async function getSubscriptionsBySubscriber(subscriberId, status) {
    let query = subscriptionsCollection().where('subscriberId', '==', subscriberId);
    if (status) {
        query = query.where('status', '==', status);
    }
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
/**
 * Lists all subscribers for a given creator, optionally filtered by plan and/or status.
 * @param creatorId The UID of the creator.
 * @param planId Optional plan ID to filter subscribers for a specific plan.
 * @param status Optional status to filter by.
 * @returns An array of user subscriptions (representing subscribers).
 */
async function getSubscribersForCreator(creatorId, planId, status) {
    let query = subscriptionsCollection().where('creatorId', '==', creatorId);
    if (planId) {
        query = query.where('planId', '==', planId);
    }
    // Fetch all active and cancelled subscriptions
    query = query.where('status', 'in', ['active', 'cancelled']);
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    if (snapshot.empty) {
        return [];
    }
    const now = new Date();
    // Only include:
    // - active
    // - cancelled but endDate > now
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(sub => sub.status === 'active' ||
        (sub.status === 'cancelled' && sub.endDate && sub.endDate.toDate() > now));
}
/**
 * Cancels a subscription. Sets its status to 'cancelled' or 'ended' based on current date vs. endDate.
 * @param subscriptionId The ID of the subscription to cancel.
 * @param userId The UID of the user initiating the cancellation (must be the subscriber).
 * @returns The updated subscription.
 * @throws Error if subscription not found, user not authorized, or subscription already inactive.
 */
async function cancelSubscription(subscriptionId, userId) {
    const subscriptionRef = subscriptionsCollection().doc(subscriptionId);
    const subscriptionDoc = await subscriptionRef.get();
    if (!subscriptionDoc.exists) {
        throw new Error('Subscription not found.');
    }
    const subscription = { id: subscriptionDoc.id, ...subscriptionDoc.data() };
    if (subscription.subscriberId !== userId) {
        throw new Error('User not authorized to cancel this subscription.');
    }
    if (subscription.status !== 'active' && subscription.status !== 'free_trial') {
        throw new Error('Subscription is already inactive.');
    }
    const now = admin.firestore.Timestamp.now();
    let newStatus = 'cancelled';
    // If subscription has already ended, mark as expired
    if (subscription.endDate && subscription.endDate.toDate() <= now.toDate()) {
        newStatus = 'expired';
    }
    // If endDate is not set, calculate it based on plan duration
    let endDate = subscription.endDate;
    if (!endDate) {
        // Fetch the plan to get duration info
        const planDoc = await plansCollection().doc(subscription.planId).get();
        if (planDoc.exists) {
            const plan = { id: planDoc.id, ...planDoc.data() };
            const startDate = subscription.startDate?.toDate() || now.toDate();
            let calculatedEndDate = null;
            if (plan.billingInterval && plan.intervalCount) {
                if (plan.billingInterval === 'month') {
                    calculatedEndDate = new Date(startDate);
                    calculatedEndDate.setMonth(calculatedEndDate.getMonth() + plan.intervalCount);
                }
                else if (plan.billingInterval === 'year') {
                    calculatedEndDate = new Date(startDate);
                    calculatedEndDate.setFullYear(calculatedEndDate.getFullYear() + plan.intervalCount);
                }
                else if (plan.billingInterval === 'day') {
                    calculatedEndDate = new Date(startDate);
                    calculatedEndDate.setDate(calculatedEndDate.getDate() + plan.intervalCount);
                }
                else if (plan.billingInterval === 'week') {
                    calculatedEndDate = new Date(startDate);
                    calculatedEndDate.setDate(calculatedEndDate.getDate() + 7 * plan.intervalCount);
                }
            }
            if (calculatedEndDate) {
                endDate = admin.firestore.Timestamp.fromDate(calculatedEndDate);
            }
        }
    }
    // Fallback: If endDate is still null, set to 30 days from startDate
    if (!endDate) {
        const fallbackStart = subscription.startDate?.toDate() || now.toDate();
        const fallbackEnd = new Date(fallbackStart);
        fallbackEnd.setDate(fallbackEnd.getDate() + 30);
        endDate = admin.firestore.Timestamp.fromDate(fallbackEnd);
        console.warn(`cancelSubscription: Could not determine endDate from plan, using fallback 30 days for subscription ${subscriptionId}`);
    }
    const updateData = {
        status: newStatus,
        updatedAt: now,
        nextBillingDate: null, // Clear next billing date since subscription is cancelled
        endDate: endDate || null,
        willRenew: false,
    };
    await subscriptionRef.update(updateData);
    return { ...subscription, ...updateData };
}
/**
 * Gets the latest subscription (any status) a user has with a specific creator.
 * @param subscriberId UID of the subscriber.
 * @param creatorId UID of the creator.
 * @returns The most recent UserSubscription or null if none found.
 */
async function getLatestSubscriptionToCreator(subscriberId, creatorId) {
    const snapshot = await subscriptionsCollection()
        .where('subscriberId', '==', subscriberId)
        .where('creatorId', '==', creatorId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
    if (snapshot.empty) {
        return null;
    }
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}
//# sourceMappingURL=subscription.service.js.map