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
exports.cleanupExpiredStories = void 0;
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
// Scheduled function to clean up expired stories and their files every hour
exports.cleanupExpiredStories = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async (context) => {
    const db = (0, firestore_1.getFirestore)();
    const storage = (0, storage_1.getStorage)().bucket();
    const now = new Date();
    let deletedCount = 0;
    try {
        // Query for expired stories
        const storiesSnapshot = await db.collection('stories')
            .where('expiresAt', '<=', now)
            .get();
        for (const doc of storiesSnapshot.docs) {
            const data = doc.data();
            const mediaUrl = data.mediaUrl;
            // Delete the Firestore document
            await doc.ref.delete();
            deletedCount++;
            // Delete the media file from storage if mediaUrl exists
            if (mediaUrl) {
                try {
                    // Extract the storage path from the mediaUrl
                    const url = new URL(mediaUrl);
                    const path = decodeURIComponent(url.pathname.split('/o/')[1]);
                    await storage.file(path).delete();
                    console.log(`[cleanupExpiredStories] Deleted file from storage: ${path}`);
                }
                catch (err) {
                    console.warn('[cleanupExpiredStories] Failed to delete media file from storage:', err);
                }
            }
        }
        console.log(`[cleanupExpiredStories] Deleted ${deletedCount} expired stories.`);
        return null;
    }
    catch (error) {
        console.error('[cleanupExpiredStories] Error deleting expired stories:', error);
        throw error;
    }
});
//# sourceMappingURL=cleanupExpiredStories.js.map