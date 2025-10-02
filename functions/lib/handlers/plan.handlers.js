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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.plansApi = void 0;
const https_1 = require("firebase-functions/v2/https");
const express_1 = __importStar(require("express"));
const cors_1 = __importDefault(require("cors"));
const admin = __importStar(require("firebase-admin"));
const functionsLogger = __importStar(require("firebase-functions/logger"));
const plan_service_1 = require("../services/plan.service");
const planApiRouter = (0, express_1.Router)();
planApiRouter.use((0, cors_1.default)({ origin: true }));
planApiRouter.use(express_1.default.json());
const authenticateAndAuthorize = async (req, res, next) => {
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
    }
    catch (error) {
        functionsLogger.error("Error while verifying Firebase ID token:", error);
        res.status(401).send({ error: "Unauthorized: Invalid token." });
    }
};
planApiRouter.use(authenticateAndAuthorize);
const authorizeCreatorOwnership = async (req, res, next) => {
    if (!req.user) {
        res.status(401).send({ error: "User not authenticated for authorization check." });
        return;
    }
    const { planId } = req.params;
    if (!planId) {
        // This middleware is for routes with /:planId, so planId should be present.
        // If creating a new plan, authorization is handled differently (creatorId in body).
        res.status(400).send({ error: "Plan ID is missing in request parameters for authorization." });
        return;
    }
    try {
        const plan = await (0, plan_service_1.getPlan)(planId);
        if (!plan) {
            res.status(404).send({ error: "Plan not found for authorization." });
            return;
        }
        if (plan.creatorId !== req.user.uid) {
            res.status(403).send({ error: "Forbidden: You do not own this plan." });
            return;
        }
        next(); // User owns the plan
    }
    catch (error) {
        functionsLogger.error("Error fetching plan for ownership authorization:", error);
        res.status(500).send({ error: "Failed to authorize plan operation due to server error." });
    }
};
planApiRouter.post("/", async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).send({ error: "User not authenticated." });
            return;
        }
        const planData = req.body;
        if (planData.creatorId !== req.user.uid) {
            functionsLogger.warn("Attempt to create plan with mismatched creatorId.", { authUid: req.user.uid, bodyUid: planData.creatorId });
            res.status(403).send({ error: "Forbidden: You can only create plans for yourself." });
            return;
        }
        const newPlan = await (0, plan_service_1.createPlan)(req.user.uid, planData);
        res.status(201).json(newPlan);
    }
    catch (error) {
        functionsLogger.error("Error creating plan:", error);
        res.status(500).json({ error: error.message || "Failed to create plan." });
    }
});
planApiRouter.get("/:planId", async (req, res) => {
    try {
        const { planId } = req.params;
        const plan = await (0, plan_service_1.getPlan)(planId);
        if (plan) {
            res.status(200).json(plan);
        }
        else {
            res.status(404).json({ message: "Plan not found." });
        }
    }
    catch (error) {
        functionsLogger.error("Error getting plan:", error);
        res.status(500).json({ error: error.message || "Failed to get plan." });
    }
});
planApiRouter.get("/creator/:creatorId", async (req, res) => {
    try {
        const { creatorId } = req.params;
        const plans = await (0, plan_service_1.getPlansByCreator)(creatorId);
        res.status(200).json(plans);
    }
    catch (error) {
        functionsLogger.error("Error getting plans by creator:", error);
        res.status(500).json({ error: error.message || "Failed to get plans by creator." });
    }
});
planApiRouter.put("/:planId", authorizeCreatorOwnership, async (req, res) => {
    try {
        if (!req.user) { // Should be caught by global auth, but defensive check.
            res.status(401).send({ error: "User not authenticated for update." });
            return;
        }
        const { planId } = req.params;
        const planData = req.body;
        if (planData.creatorId && planData.creatorId !== req.user.uid) {
            res.status(400).send({ error: "Bad Request: Cannot change creatorId of a plan." });
            return;
        }
        // Remove creatorId from planData if present, as it's immutable or derived from auth user.
        // The authorizeCreatorOwnership middleware already confirmed ownership.
        const { creatorId, ...updateData } = planData;
        const updatedPlan = await (0, plan_service_1.updatePlan)(planId, req.user.uid, updateData);
        if (updatedPlan) {
            res.status(200).json(updatedPlan);
        }
        else {
            res.status(404).json({ message: "Plan not found or update failed." });
        }
    }
    catch (error) {
        functionsLogger.error("Error updating plan:", error);
        res.status(500).json({ error: error.message || "Failed to update plan." });
    }
});
planApiRouter.delete("/:planId", authorizeCreatorOwnership, async (req, res) => {
    try {
        const { planId } = req.params;
        if (!req.user) { // Defensive check, should be caught by global auth + authorizeCreatorOwnership
            res.status(401).send({ error: "User not authenticated for delete operation." });
            return;
        }
        await (0, plan_service_1.deletePlan)(planId, req.user.uid);
        res.status(200).json({ message: "Plan deleted successfully." });
    }
    catch (error) {
        functionsLogger.error("Error deleting plan:", error);
        res.status(500).json({ error: error.message || "Failed to delete plan." });
    }
});
planApiRouter.post("/creator/set-default", async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).send({ error: "User not authenticated." });
            return;
        }
        const { planId: requestedPlanId, subscriptionType } = req.body;
        const creatorId = req.user.uid;
        if (!subscriptionType || (subscriptionType !== "free" && subscriptionType !== "paid")) {
            res.status(400).json({ error: "Invalid subscription type. Must be 'free' or 'paid'." });
            return;
        }
        if (subscriptionType === "paid" && !requestedPlanId) {
            res.status(400).json({ error: "Plan ID is required for paid default subscription type." });
            return;
        }
        const effectivePlanId = requestedPlanId === undefined ? null : requestedPlanId;
        if (subscriptionType === "paid" && effectivePlanId) {
            const planToSet = await (0, plan_service_1.getPlan)(effectivePlanId);
            if (!planToSet) {
                res.status(404).json({ error: "Plan to set as default not found." });
                return;
            }
            if (planToSet.creatorId !== creatorId) {
                res.status(403).json({ error: "Cannot set a plan you do not own as default." });
                return;
            }
        }
        await (0, plan_service_1.setDefaultPlanForCreator)(creatorId, effectivePlanId, subscriptionType);
        res.status(200).json({ message: "Default plan set successfully for creator." });
    }
    catch (error) {
        functionsLogger.error("Error setting default plan:", error);
        res.status(500).json({ error: error.message || "Failed to set default plan." });
    }
});
// Create an Express app and use the router
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true })); // Apply CORS at the app level too, or ensure router handles it sufficiently
app.use(express_1.default.json()); // Ensure body parsing is available for the app
app.use(planApiRouter); // Use the router, assuming it handles all paths under this function
exports.plansApi = (0, https_1.onRequest)(app); // Export the Express app 
//# sourceMappingURL=plan.handlers.js.map