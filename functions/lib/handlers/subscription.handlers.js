"use strict";
// Handlers for subscription-related Firebase Functions
// These will use the SubscriptionService to interact with the database
// and will be exported to be used in index.ts
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionsApi = void 0;
// Example (to be implemented, likely using Express within https.onRequest):
// import * as functions from 'firebase-functions';
// import * as express from 'express';
// import * as subscriptionService from '../services/subscription.service';
// import { authenticateUser } from '../middleware/auth.middleware'; // Assuming auth middleware
// const app = express();
// app.post('/users/:userIdToFollow/follow', authenticateUser, async (req, res) => {
//   const authenticatedUserId = req.user.id; // from authenticateUser middleware
//   const { userIdToFollow } = req.params;
//   try {
//     await subscriptionService.createSubscription(authenticatedUserId, userIdToFollow);
//     res.status(201).send({ message: 'Successfully subscribed' });
//   } catch (error) {
//     console.error('Error subscribing user:', error);
//     res.status(500).send({ error: 'Failed to subscribe' });
//   }
// });
// app.delete('/users/:userIdToUnfollow/unfollow', authenticateUser, async (req, res) => {
//   // ... implementation ...
// });
// export const subscriptionApi = functions.https.onRequest(app);
const https_1 = require("firebase-functions/v2/https");
const express_1 = __importStar(require("express"));
const cors_1 = __importDefault(require("cors"));
const admin = __importStar(require("firebase-admin"));
const functionsLogger = __importStar(require("firebase-functions/logger"));
const subscriptionService = __importStar(require("../services/subscription.service"));
const subscriptionApiRouter = (0, express_1.Router)();
subscriptionApiRouter.use((0, cors_1.default)({ origin: true })); // Enable CORS for all routes
subscriptionApiRouter.use(express_1.default.json()); // Middleware to parse JSON bodies
// Middleware for Firebase ID Token Authentication (same as in plan.handlers.ts)
const authenticateAndAuthorize = async (req, res, next) => {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
        functionsLogger.warn("Subscription API: No Firebase ID token was passed as a Bearer token.");
        res.status(401).send({ error: "Unauthorized: No token provided." });
        return;
    }
    const idToken = authorizationHeader.split("Bearer ")[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    }
    catch (error) {
        functionsLogger.error("Subscription API: Error verifying Firebase ID token:", error);
        res.status(401).send({ error: "Unauthorized: Invalid token." });
    }
};
// Apply general authentication middleware to all subscription routes
subscriptionApiRouter.use(authenticateAndAuthorize);
// --- Subscription Routes ---
// Create a new subscription (user subscribes to a plan)
subscriptionApiRouter.post('/', async (req, res) => {
    try {
        if (!req.user?.uid) { // Defensive check, though authenticateAndAuthorize should ensure req.user exists
            functionsLogger.warn("Subscription API: User UID not found after authentication for create.");
            res.status(401).send({ error: 'Unauthorized: User not properly authenticated.' });
            return;
        }
        const subscriberId = req.user.uid;
        const { creatorId, planId, promoCode } = req.body;
        if (!creatorId || !planId) {
            res.status(400).send({ error: 'Missing creatorId or planId in request body.' });
            return;
        }
        const newSubscription = await subscriptionService.createSubscription(subscriberId, creatorId, planId, promoCode);
        res.status(201).json(newSubscription); // Changed send to json for consistency
    }
    catch (error) {
        functionsLogger.error('Subscription API: Error creating subscription:', error.message, error);
        if (error.message?.includes('Plan not found') ||
            error.message?.includes('does not belong') ||
            error.message?.includes('not active') ||
            error.message?.includes('already actively subscribed') ||
            error.message?.includes('Cannot subscribe to your own plan')) {
            res.status(400).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: 'Failed to create subscription.', details: error.message });
        }
    }
});
// Get the latest subscription (active, cancelled, or expired) of the authenticated user to a specific creator
subscriptionApiRouter.get('/to/:creatorId/latest', async (req, res) => {
    try {
        if (!req.user?.uid) {
            res.status(401).json({ message: 'Unauthorized: User not properly authenticated.' });
            return;
        }
        const { creatorId } = req.params;
        const subscriberId = req.user.uid;
        const subscription = await subscriptionService.getLatestSubscriptionToCreator(subscriberId, creatorId);
        if (!subscription) {
            res.status(404).json({ message: 'No subscription found' });
            return;
        }
        res.json(subscription);
    }
    catch (error) {
        console.error('Error getting latest subscription:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// List all subscriptions for the authenticated user
subscriptionApiRouter.get('/me', async (req, res) => {
    try {
        if (!req.user?.uid) {
            functionsLogger.warn("Subscription API: User UID not found after authentication for get my subscriptions.");
            res.status(401).send({ error: 'Unauthorized: User not properly authenticated.' });
            return;
        }
        const subscriberId = req.user.uid;
        const { status } = req.query;
        const subscriptions = await subscriptionService.getSubscriptionsBySubscriber(subscriberId, status);
        res.status(200).json(subscriptions); // Changed send to json
    }
    catch (error) {
        functionsLogger.error('Subscription API: Error fetching user subscriptions:', error.message, error);
        res.status(500).json({ error: 'Failed to fetch user subscriptions.', details: error.message });
    }
});
// List all subscribers for a specific creator
// Requires the authenticated user to be the creatorId specified in the path
subscriptionApiRouter.get('/by-creator/:creatorId', async (req, res) => {
    try {
        if (!req.user?.uid) {
            functionsLogger.warn("Subscription API: User UID not found after authentication for get subscribers by creator.");
            res.status(401).send({ error: 'Unauthorized: User not properly authenticated.' });
            return;
        }
        const { creatorId } = req.params;
        const authenticatedUserId = req.user.uid;
        if (creatorId !== authenticatedUserId) {
            functionsLogger.warn(`Subscription API: User ${authenticatedUserId} attempted to access subscribers for creator ${creatorId}.`);
            res.status(403).json({ error: 'Unauthorized to view subscribers for this creator.' }); // Changed send to json
            return;
        }
        const { planId, status } = req.query;
        const subscribers = await subscriptionService.getSubscribersForCreator(creatorId, planId, status);
        res.status(200).json(subscribers); // Changed send to json
    }
    catch (error) {
        functionsLogger.error('Subscription API: Error fetching creator subscribers:', error.message, error);
        res.status(500).json({ error: 'Failed to fetch creator subscribers.', details: error.message });
    }
});
// Cancel a subscription (initiated by the subscriber)
subscriptionApiRouter.put('/:subscriptionId/cancel', async (req, res) => {
    try {
        if (!req.user?.uid) {
            functionsLogger.warn("Subscription API: User UID not found after authentication for cancel subscription.");
            res.status(401).send({ error: 'Unauthorized: User not properly authenticated.' });
            return;
        }
        const { subscriptionId } = req.params;
        const userId = req.user.uid; // User cancelling must be the subscriber
        const updatedSubscription = await subscriptionService.cancelSubscription(subscriptionId, userId);
        res.status(200).json(updatedSubscription); // Changed send to json
    }
    catch (error) {
        functionsLogger.error('Subscription API: Error cancelling subscription:', error.message, error);
        if (error.message?.includes('not found') ||
            error.message?.includes('not authorized') ||
            error.message?.includes('already inactive')) {
            res.status(400).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: 'Failed to cancel subscription.', details: error.message });
        }
    }
});
// Create an Express app and use the router
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true })); // Apply CORS at the app level too, or ensure router handles it sufficiently
app.use(express_1.default.json()); // Ensure body parsing is available for the app
app.use(subscriptionApiRouter); // Use the router, assuming it handles all paths under this function
exports.subscriptionsApi = (0, https_1.onRequest)(app); // Export the Express app 
//# sourceMappingURL=subscription.handlers.js.map