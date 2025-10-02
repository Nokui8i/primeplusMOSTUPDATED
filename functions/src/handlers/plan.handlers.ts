import { onRequest } from "firebase-functions/v2/https";
import express, { Router, Request, Response, NextFunction } from "express";
import cors from "cors";
import * as admin from "firebase-admin";
import * as functionsLogger from "firebase-functions/logger";
import {
  createPlan as createPlanService,
  getPlan as getPlanService,
  getPlansByCreator as getPlansByCreatorService,
  updatePlan as updatePlanService,
  deletePlan as deletePlanService,
  setDefaultPlanForCreator as setDefaultPlanForCreatorService,
} from "../services/plan.service";
import { Plan, PlanData } from "../models/plan.model";

const planApiRouter = Router();
planApiRouter.use(cors({ origin: true }));
planApiRouter.use(express.json());

interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

const authenticateAndAuthorize = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    functionsLogger.warn("No Firebase ID token was passed as a Bearer token in the Authorization header.");
    res.status(401).send({ error: "Unauthorized: No token provided." });
    return;
  }
  const idToken = authorizationHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    functionsLogger.error("Error while verifying Firebase ID token:", error);
    res.status(401).send({ error: "Unauthorized: Invalid token." });
  }
};

planApiRouter.use(authenticateAndAuthorize);

const authorizeCreatorOwnership = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).send({ error: "User not authenticated for authorization check." });
    return;
  }
  const { planId } = req.params;
  if (!planId) {
    // This middleware is for routes with /:planId, so planId should be present.
    // If creating a new plan, authorization is handled differently (creatorId in body).
    res.status(400).send({ error: "Plan ID is missing in request parameters for authorization."} );
    return;
  }
  try {
    const plan = await getPlanService(planId);
    if (!plan) {
      res.status(404).send({ error: "Plan not found for authorization." });
      return;
    }
    if (plan.creatorId !== req.user.uid) {
      res.status(403).send({ error: "Forbidden: You do not own this plan." });
      return;
    }
    next(); // User owns the plan
  } catch (error) {
    functionsLogger.error("Error fetching plan for ownership authorization:", error);
    res.status(500).send({ error: "Failed to authorize plan operation due to server error." });
  }
};

planApiRouter.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).send({ error: "User not authenticated." });
      return;
    }
    const planData: PlanData = req.body;
    if (planData.creatorId !== req.user.uid) {
      functionsLogger.warn("Attempt to create plan with mismatched creatorId.", { authUid: req.user.uid, bodyUid: planData.creatorId });
      res.status(403).send({ error: "Forbidden: You can only create plans for yourself." });
      return;
    }
    const newPlan = await createPlanService(req.user.uid, planData);
    res.status(201).json(newPlan);
  } catch (error: any) {
    functionsLogger.error("Error creating plan:", error);
    res.status(500).json({ error: error.message || "Failed to create plan." });
  }
});

planApiRouter.get("/:planId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { planId } = req.params;
    const plan = await getPlanService(planId);
    if (plan) {
      res.status(200).json(plan);
    } else {
      res.status(404).json({ message: "Plan not found." });
    }
  } catch (error: any) {
    functionsLogger.error("Error getting plan:", error);
    res.status(500).json({ error: error.message || "Failed to get plan." });
  }
});

planApiRouter.get("/creator/:creatorId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { creatorId } = req.params;
    const plans = await getPlansByCreatorService(creatorId);
    res.status(200).json(plans);
  } catch (error: any) {
    functionsLogger.error("Error getting plans by creator:", error);
    res.status(500).json({ error: error.message || "Failed to get plans by creator." });
  }
});

planApiRouter.put("/:planId", authorizeCreatorOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) { // Should be caught by global auth, but defensive check.
      res.status(401).send({ error: "User not authenticated for update." });
      return;
    }
    const { planId } = req.params;
    const planData: Partial<PlanData> = req.body;
    if (planData.creatorId && planData.creatorId !== req.user.uid) {
      res.status(400).send({ error: "Bad Request: Cannot change creatorId of a plan." });
      return;
    }
    // Remove creatorId from planData if present, as it's immutable or derived from auth user.
    // The authorizeCreatorOwnership middleware already confirmed ownership.
    const { creatorId, ...updateData } = planData;

    const updatedPlan = await updatePlanService(planId, req.user.uid, updateData);
    if (updatedPlan) {
      res.status(200).json(updatedPlan);
    } else {
      res.status(404).json({ message: "Plan not found or update failed." });
    }
  } catch (error: any) {
    functionsLogger.error("Error updating plan:", error);
    res.status(500).json({ error: error.message || "Failed to update plan." });
  }
});

planApiRouter.delete("/:planId", authorizeCreatorOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { planId } = req.params;
    if (!req.user) { // Defensive check, should be caught by global auth + authorizeCreatorOwnership
      res.status(401).send({ error: "User not authenticated for delete operation." });
      return;
    }
    await deletePlanService(planId, req.user.uid);
    res.status(200).json({ message: "Plan deleted successfully." });
  } catch (error: any) {
    functionsLogger.error("Error deleting plan:", error);
    res.status(500).json({ error: error.message || "Failed to delete plan." });
  }
});

planApiRouter.post("/creator/set-default", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).send({ error: "User not authenticated." });
      return;
    }
    const { planId: requestedPlanId, subscriptionType } = req.body as { planId?: string, subscriptionType: "free" | "paid" };
    const creatorId = req.user.uid;

    if (!subscriptionType || (subscriptionType !== "free" && subscriptionType !== "paid")) {
      res.status(400).json({error: "Invalid subscription type. Must be 'free' or 'paid'."});
      return;
    }
    if (subscriptionType === "paid" && !requestedPlanId) {
      res.status(400).json({error: "Plan ID is required for paid default subscription type."});
      return;
    }

    const effectivePlanId = requestedPlanId === undefined ? null : requestedPlanId;

    if (subscriptionType === "paid" && effectivePlanId) {
      const planToSet = await getPlanService(effectivePlanId);
      if (!planToSet) {
        res.status(404).json({error: "Plan to set as default not found."});
        return;
      }
      if (planToSet.creatorId !== creatorId) {
        res.status(403).json({error: "Cannot set a plan you do not own as default."});
        return;
      }
    }

    await setDefaultPlanForCreatorService(creatorId, effectivePlanId, subscriptionType);
    res.status(200).json({ message: "Default plan set successfully for creator." });
  } catch (error: any) {
    functionsLogger.error("Error setting default plan:", error);
    res.status(500).json({ error: error.message || "Failed to set default plan." });
  }
});

// Create an Express app and use the router
const app = express();
app.use(cors({ origin: true })); // Apply CORS at the app level too, or ensure router handles it sufficiently
app.use(express.json()); // Ensure body parsing is available for the app
app.use(planApiRouter); // Use the router, assuming it handles all paths under this function

export const plansApi = onRequest(app); // Export the Express app 