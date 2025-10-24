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
exports.onUserCreate = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Function to get Firestore instance, ensuring app is initialized
const getDb = () => {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
    return admin.firestore();
};
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
    const db = getDb(); // Get DB instance when function is invoked
    const { uid, email, displayName, photoURL } = user;
    const newUserDocRef = db.collection('users').doc(uid);
    const batch = db.batch();
    // 1. Create the user document (no plan creation)
    batch.set(newUserDocRef, {
        uid: uid,
        email: email || null,
        displayName: displayName || email?.split('@')[0] || 'New User', // Default display name
        username: (displayName || email?.split('@')[0] || uid.substring(0, 8)).replace(/\s+/g, '').toLowerCase(), // Default username
        photoURL: photoURL || null, // Default photo URL (can be a placeholder)
        // Optionally set default coverPhotoUrl/profilePhotoUrl here if needed
        role: 'user', // All users are users by default
        isActive: true, // Ensure all new users are active by default
        followersCount: 0, // Initialize followers counter
        followingCount: 0, // Initialize following counter
        profileCompleted: true, // Mark profile as completed by default
        privacy: {
            profileVisibility: 'public', // Default to public profile visibility
            allowComments: true,
            allowTagging: true,
            showActivityStatus: true,
            onlineStatus: 'everyone'
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Add any other fields needed for the follow system only
    });
    try {
        await batch.commit();
        console.log(`User ${uid} successfully created as creator with default plan.`);
    }
    catch (error) {
        console.error(`Error setting up new user ${uid} as creator:`, error);
        // Optional: attempt to clean up if one part of the batch failed, though it's tricky.
        // Or log for manual intervention.
    }
});
//# sourceMappingURL=authTriggers.js.map