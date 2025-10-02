import * as admin from 'firebase-admin';
import { Plan } from '../models/plan.model';
import { User } from '../models/user.model'; // For creator validation if needed

// Function to get Firestore instance, ensuring app is initialized
const getDb = () => {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  return admin.firestore();
};

// Use the getter function to initialize db and collections
const db = getDb();
const plansCollection = () => db.collection('plans');
const usersCollection = () => db.collection('users');

/**
 * Creates a new subscription plan for a creator.
 * @param creatorId The UID of the creator.
 * @param planData Data for the new plan.
 * @returns The created plan with its ID.
 */
export async function createPlan(
  creatorId: string,
  planData: Omit<Plan, 'id' | 'creatorId' | 'createdAt' | 'updatedAt'>
): Promise<Plan> {
  const now = admin.firestore.Timestamp.now(); // Timestamp can be accessed directly
  const newPlanRef = plansCollection().doc();
  const newPlan: Plan = {
    id: newPlanRef.id,
    creatorId,
    ...planData,
    createdAt: now,
    updatedAt: now,
  };
  await newPlanRef.set(newPlan);
  return newPlan;
}

/**
 * Retrieves a specific plan by its ID.
 * @param planId The ID of the plan to retrieve.
 * @returns The plan object or null if not found.
 */
export async function getPlan(planId: string): Promise<Plan | null> {
  const planDoc = await plansCollection().doc(planId).get();
  if (!planDoc.exists) {
    return null;
  }
  return { id: planDoc.id, ...planDoc.data() } as Plan;
}

/**
 * Retrieves all plans for a specific creator.
 * @param creatorId The UID of the creator.
 * @returns An array of plans.
 */
export async function getPlansByCreator(creatorId: string): Promise<Plan[]> {
  const snapshot = await plansCollection().where('creatorId', '==', creatorId).get();
  if (snapshot.empty) {
    return [];
  }
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
}

/**
 * Updates an existing subscription plan.
 * @param planId The ID of the plan to update.
 * @param creatorId The UID of the creator (for ownership verification).
 * @param planUpdateData Partial data to update the plan with.
 * @returns The updated plan.
 * @throws Error if plan not found or user is not the owner.
 */
export async function updatePlan(
  planId: string,
  creatorId: string,
  planUpdateData: Partial<Omit<Plan, 'id' | 'creatorId' | 'createdAt'>>
): Promise<Plan> {
  const planRef = plansCollection().doc(planId);
  const planDoc = await planRef.get();

  if (!planDoc.exists) {
    throw new Error('Plan not found.');
  }

  const currentPlan = { id: planDoc.id, ...planDoc.data() } as Plan;
  if (currentPlan.creatorId !== creatorId) {
    throw new Error('User is not authorized to update this plan.');
  }

  const updatePayload = {
    ...planUpdateData,
    updatedAt: admin.firestore.Timestamp.now(),
  };

  await planRef.update(updatePayload);
  return { ...currentPlan, ...updatePayload } as Plan;
}

/**
 * Deletes a subscription plan.
 * @param planId The ID of the plan to delete.
 * @param creatorId The UID of the creator (for ownership verification).
 * @throws Error if plan not found or user is not the owner.
 */
export async function deletePlan(planId: string, creatorId: string): Promise<void> {
  const planRef = plansCollection().doc(planId);
  const planDoc = await planRef.get();

  if (!planDoc.exists) {
    throw new Error('Plan not found.');
  }
  if (planDoc.data()?.creatorId !== creatorId) {
    throw new Error('User is not authorized to delete this plan.');
  }
  // TODO: Consider implications: What happens to existing subscribers on this plan?
  // Maybe set plan to isActive = false instead of outright deletion?
  // Or, ensure no active subscriptions exist before deletion.
  // For now, direct delete as per function name.
  await planRef.delete();
}

/**
 * Sets a plan as the default for a creator.
 * This involves updating the user's document.
 * @param creatorId The UID of the creator.
 * @param planId The ID of the plan to set as default (can be null to unset).
 * @param subscriptionType The type of the default subscription ('free' or 'paid').
 */
export async function setDefaultPlanForCreator(
  creatorId: string,
  planId: string | null,
  subscriptionType: 'free' | 'paid'
): Promise<void> {
  const userRef = usersCollection().doc(creatorId);
  if (planId) {
    const plan = await getPlan(planId); // getPlan uses plansCollection() internally
    if (!plan || plan.creatorId !== creatorId) {
      throw new Error('Invalid planId or plan does not belong to the creator.');
    }
    if (subscriptionType === 'free' && plan.price !== 0) {
      throw new Error('Cannot set a paid plan as default for type \'free\'.');
    }
    if (subscriptionType === 'paid' && plan.price === 0) {
      throw new Error('Cannot set a free plan as default for type \'paid\'.');
    }
  }

  await userRef.update({
    defaultSubscriptionPlanId: planId,
    defaultSubscriptionType: subscriptionType,
    updatedAt: admin.firestore.Timestamp.now(),
  });
} 