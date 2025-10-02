// Handlers for subscription-related Firebase Functions
// These will use the SubscriptionService to interact with the database
// and will be exported to be used in index.ts

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

import { onRequest } from 'firebase-functions/v2/https';
import express, { Request, Response, NextFunction, Router } from 'express';
import cors from 'cors';
import * as admin from 'firebase-admin';
import * as functionsLogger from 'firebase-functions/logger';
import * as subscriptionService from '../services/subscription.service';
import { UserSubscription } from '../models/subscription.model';

const subscriptionApiRouter = Router();

subscriptionApiRouter.use(cors({ origin: true })); // Enable CORS for all routes
subscriptionApiRouter.use(express.json()); // Middleware to parse JSON bodies

// Extend Express Request type to include Firebase decoded ID token
interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken; // Changed from generic object to DecodedIdToken
}

// Middleware for Firebase ID Token Authentication (same as in plan.handlers.ts)
const authenticateAndAuthorize = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
  } catch (error) {
    functionsLogger.error("Subscription API: Error verifying Firebase ID token:", error);
    res.status(401).send({ error: "Unauthorized: Invalid token." });
  }
};

// Apply general authentication middleware to all subscription routes
subscriptionApiRouter.use(authenticateAndAuthorize);

// --- Subscription Routes ---

// Create a new subscription (user subscribes to a plan)
subscriptionApiRouter.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.uid) { // Defensive check, though authenticateAndAuthorize should ensure req.user exists
      functionsLogger.warn("Subscription API: User UID not found after authentication for create.");
      res.status(401).send({ error: 'Unauthorized: User not properly authenticated.' });
      return;
    }
    const subscriberId = req.user.uid;
    const { creatorId, planId, promoCode } = req.body as { creatorId: string; planId: string; promoCode?: string };

    if (!creatorId || !planId) {
      res.status(400).send({ error: 'Missing creatorId or planId in request body.' });
      return;
    }

    const newSubscription = await subscriptionService.createSubscription(subscriberId, creatorId, planId, promoCode);
    res.status(201).json(newSubscription); // Changed send to json for consistency
  } catch (error: any) {
    functionsLogger.error('Subscription API: Error creating subscription:', error.message, error);
    if (error.message?.includes('Plan not found') || 
        error.message?.includes('does not belong') || 
        error.message?.includes('not active') || 
        error.message?.includes('already actively subscribed') ||
        error.message?.includes('Cannot subscribe to your own plan')) {
        res.status(400).json({ error: error.message });
    } else {
        res.status(500).json({ error: 'Failed to create subscription.', details: error.message });
    }
  }
});

// Get the latest subscription (active, cancelled, or expired) of the authenticated user to a specific creator
subscriptionApiRouter.get('/to/:creatorId/latest', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
  } catch (error) {
    console.error('Error getting latest subscription:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// List all subscriptions for the authenticated user
subscriptionApiRouter.get('/me', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.uid) {
        functionsLogger.warn("Subscription API: User UID not found after authentication for get my subscriptions.");
        res.status(401).send({ error: 'Unauthorized: User not properly authenticated.' });
        return;
    }
    const subscriberId = req.user.uid;
    const { status } = req.query as { status?: UserSubscription['status'] };
    const subscriptions = await subscriptionService.getSubscriptionsBySubscriber(subscriberId, status);
    res.status(200).json(subscriptions); // Changed send to json
  } catch (error: any) {
    functionsLogger.error('Subscription API: Error fetching user subscriptions:', error.message, error);
    res.status(500).json({ error: 'Failed to fetch user subscriptions.', details: error.message });
  }
});

// List all subscribers for a specific creator
// Requires the authenticated user to be the creatorId specified in the path
subscriptionApiRouter.get('/by-creator/:creatorId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
        res.status(403).json({ error: 'Unauthorized to view subscribers for this creator.'}); // Changed send to json
        return;
    }

    const { planId, status } = req.query as { planId?: string; status?: UserSubscription['status'] };
    const subscribers = await subscriptionService.getSubscribersForCreator(creatorId, planId, status);
    res.status(200).json(subscribers); // Changed send to json
  } catch (error: any) {
    functionsLogger.error('Subscription API: Error fetching creator subscribers:', error.message, error);
    res.status(500).json({ error: 'Failed to fetch creator subscribers.', details: error.message });
  }
});

// Cancel a subscription (initiated by the subscriber)
subscriptionApiRouter.put('/:subscriptionId/cancel', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
  } catch (error: any) {
    functionsLogger.error('Subscription API: Error cancelling subscription:', error.message, error);
    if (error.message?.includes('not found') || 
        error.message?.includes('not authorized') || 
        error.message?.includes('already inactive')) {
        res.status(400).json({ error: error.message });
    } else {
        res.status(500).json({ error: 'Failed to cancel subscription.', details: error.message });
    }
  }
});

// Create an Express app and use the router
const app = express();
app.use(cors({ origin: true })); // Apply CORS at the app level too, or ensure router handles it sufficiently
app.use(express.json()); // Ensure body parsing is available for the app
app.use(subscriptionApiRouter); // Use the router, assuming it handles all paths under this function

export const subscriptionsApi = onRequest(app); // Export the Express app 