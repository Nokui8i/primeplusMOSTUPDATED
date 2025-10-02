"use strict";
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
exports.createPlan = createPlan;
exports.getPlan = getPlan;
exports.getPlansByCreator = getPlansByCreator;
exports.updatePlan = updatePlan;
exports.deletePlan = deletePlan;
exports.setDefaultPlanForCreator = setDefaultPlanForCreator;
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
const plansCollection = () => db.collection('plans');
const usersCollection = () => db.collection('users');
/**
 * Creates a new subscription plan for a creator.
 * @param creatorId The UID of the creator.
 * @param planData Data for the new plan.
 * @returns The created plan with its ID.
 */
async function createPlan(creatorId, planData) {
    const now = admin.firestore.Timestamp.now(); // Timestamp can be accessed directly
    const newPlanRef = plansCollection().doc();
    const newPlan = {
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
async function getPlan(planId) {
    const planDoc = await plansCollection().doc(planId).get();
    if (!planDoc.exists) {
        return null;
    }
    return { id: planDoc.id, ...planDoc.data() };
}
/**
 * Retrieves all plans for a specific creator.
 * @param creatorId The UID of the creator.
 * @returns An array of plans.
 */
async function getPlansByCreator(creatorId) {
    const snapshot = await plansCollection().where('creatorId', '==', creatorId).get();
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
/**
 * Updates an existing subscription plan.
 * @param planId The ID of the plan to update.
 * @param creatorId The UID of the creator (for ownership verification).
 * @param planUpdateData Partial data to update the plan with.
 * @returns The updated plan.
 * @throws Error if plan not found or user is not the owner.
 */
async function updatePlan(planId, creatorId, planUpdateData) {
    const planRef = plansCollection().doc(planId);
    const planDoc = await planRef.get();
    if (!planDoc.exists) {
        throw new Error('Plan not found.');
    }
    const currentPlan = { id: planDoc.id, ...planDoc.data() };
    if (currentPlan.creatorId !== creatorId) {
        throw new Error('User is not authorized to update this plan.');
    }
    const updatePayload = {
        ...planUpdateData,
        updatedAt: admin.firestore.Timestamp.now(),
    };
    await planRef.update(updatePayload);
    return { ...currentPlan, ...updatePayload };
}
/**
 * Deletes a subscription plan.
 * @param planId The ID of the plan to delete.
 * @param creatorId The UID of the creator (for ownership verification).
 * @throws Error if plan not found or user is not the owner.
 */
async function deletePlan(planId, creatorId) {
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
async function setDefaultPlanForCreator(creatorId, planId, subscriptionType) {
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
//# sourceMappingURL=plan.service.js.map