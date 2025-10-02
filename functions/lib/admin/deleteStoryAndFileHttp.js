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
exports.deleteStoryAndFileHttp = void 0;
// DEBUG: Return all story IDs and count for debugging (no storyId required, v2-debug-final-2025-05-26)
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.deleteStoryAndFileHttp = (0, https_1.onRequest)({
    region: 'us-central1',
    cors: true,
    maxInstances: 10
}, async (req, res) => {
    // Log request details
    console.log('[deleteStoryAndFileHttp] Request received:', {
        method: req.method,
        headers: req.headers,
        body: req.body
    });
    try {
        // Validate request method
        if (req.method !== 'POST') {
            console.error('[deleteStoryAndFileHttp] Invalid method:', req.method);
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        // Get storyId from request body
        const { storyId } = req.body;
        if (!storyId) {
            console.error('[deleteStoryAndFileHttp] Missing storyId');
            res.status(400).json({ error: 'Missing storyId' });
            return;
        }
        console.log('[deleteStoryAndFileHttp] Processing storyId:', storyId);
        // Get Firestore and Storage instances
        const db = (0, firestore_1.getFirestore)();
        const bucket = (0, storage_1.getStorage)().bucket();
        // Get the story document
        const storyRef = db.collection('stories').doc(storyId);
        const storyDoc = await storyRef.get();
        if (!storyDoc.exists) {
            console.error('[deleteStoryAndFileHttp] Story not found:', storyId);
            res.status(404).json({ error: 'Story not found' });
            return;
        }
        // Get story data
        const storyData = storyDoc.data();
        console.log('[deleteStoryAndFileHttp] Found story data:', storyData);
        // Get media URL
        const mediaUrl = storyData?.mediaUrl;
        console.log('[deleteStoryAndFileHttp] Media URL:', mediaUrl);
        // Delete the Firestore document
        console.log('[deleteStoryAndFileHttp] Deleting story document');
        await storyRef.delete();
        // Delete the media file if it exists
        if (mediaUrl) {
            try {
                // Extract the file path from the URL
                const filePath = mediaUrl.split('/o/')[1]?.split('?')[0];
                if (filePath) {
                    const decodedPath = decodeURIComponent(filePath);
                    console.log('[deleteStoryAndFileHttp] Deleting file from storage:', decodedPath);
                    await bucket.file(decodedPath).delete();
                    console.log('[deleteStoryAndFileHttp] Successfully deleted file from storage');
                }
            }
            catch (storageError) {
                console.error('[deleteStoryAndFileHttp] Failed to delete media file:', storageError);
                // Continue even if storage deletion fails
            }
        }
        console.log('[deleteStoryAndFileHttp] Successfully completed deletion');
        res.json({
            success: true,
            message: 'Story and media deleted successfully',
            storyId: storyId
        });
    }
    catch (error) {
        console.error('[deleteStoryAndFileHttp] Error:', error);
        res.status(500).json({
            error: 'Failed to delete story',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
//# sourceMappingURL=deleteStoryAndFileHttp.js.map