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
exports.deleteStoryAndFileHttp = exports.cleanupExpiredStories = exports.restoreUserRoles = exports.sendNotificationHttp = exports.deleteCreatorVerificationDataHttp = exports.onFollowWrite = exports.setupExistingUsers = exports.onUserCreate = exports.subscriptionsApi = exports.plansApi = exports.testHttp = exports.cleanupStorageOnStoryDelete = exports.cleanupStorageOnUserDelete = exports.cleanupStorageOnPostDelete = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
// Import and re-export API handlers
const plan_handlers_1 = require("./handlers/plan.handlers");
Object.defineProperty(exports, "plansApi", { enumerable: true, get: function () { return plan_handlers_1.plansApi; } });
const subscription_handlers_1 = require("./handlers/subscription.handlers");
Object.defineProperty(exports, "subscriptionsApi", { enumerable: true, get: function () { return subscription_handlers_1.subscriptionsApi; } });
// Import and re-export Auth triggers
const authTriggers_1 = require("./triggers/authTriggers");
Object.defineProperty(exports, "onUserCreate", { enumerable: true, get: function () { return authTriggers_1.onUserCreate; } });
// Import and re-export Migration/Admin tasks
const setupExistingUsers_1 = require("./migrations/setupExistingUsers");
Object.defineProperty(exports, "setupExistingUsers", { enumerable: true, get: function () { return setupExistingUsers_1.setupExistingUsers; } });
// Import and re-export Follow triggers
const followTriggers_1 = require("./triggers/followTriggers");
Object.defineProperty(exports, "onFollowWrite", { enumerable: true, get: function () { return followTriggers_1.onFollowWrite; } });
const supportActions_1 = require("./admin/supportActions");
Object.defineProperty(exports, "deleteCreatorVerificationDataHttp", { enumerable: true, get: function () { return supportActions_1.deleteCreatorVerificationDataHttp; } });
const notifications_1 = require("./admin/notifications");
Object.defineProperty(exports, "sendNotificationHttp", { enumerable: true, get: function () { return notifications_1.sendNotificationHttp; } });
/**
 * Cloud Function to automatically delete files from Storage when a post is deleted
 * This function triggers whenever a document in the 'posts' collection is deleted
 */
exports.cleanupStorageOnPostDelete = (0, firestore_1.onDocumentDeleted)('posts/{postId}', async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    const bucket = admin.storage().bucket();
    const deletedFiles = [];
    try {
        // Handle media files
        if (data.mediaFiles && Array.isArray(data.mediaFiles)) {
            for (const file of data.mediaFiles) {
                if (file.path) {
                    const fileRef = bucket.file(file.path);
                    await fileRef.delete();
                    deletedFiles.push(file.path);
                }
            }
        }
        // Handle thumbnail if exists
        if (data.thumbnailPath) {
            const thumbnailRef = bucket.file(data.thumbnailPath);
            await thumbnailRef.delete();
            deletedFiles.push(data.thumbnailPath);
        }
        // Handle main image if exists
        if (data.imagePath) {
            const imageRef = bucket.file(data.imagePath);
            await imageRef.delete();
            deletedFiles.push(data.imagePath);
        }
        // Log successful deletions
        console.log(`Successfully deleted ${deletedFiles.length} files for post ${event.params.postId}:`, deletedFiles);
    }
    catch (error) {
        console.error(`Error deleting files for post ${event.params.postId}:`, error);
        throw error;
    }
});
/**
 * Cloud Function to handle user deletion and cleanup
 * This function should be called by a Cloud Function trigger when a user is deleted
 */
exports.cleanupStorageOnUserDelete = (0, https_1.onRequest)(async (request, response) => {
    // Get the user ID from the request body
    const { userId } = request.body;
    if (!userId) {
        response.status(400).send({ error: 'User ID is required' });
        return;
    }
    const bucket = admin.storage().bucket();
    try {
        // Delete all files in user's content directory
        const userContentPath = `content/${userId}`;
        const [files] = await bucket.getFiles({ prefix: userContentPath });
        const deletePromises = files.map(file => file.delete());
        await Promise.all(deletePromises);
        // Delete user's profile directory
        const userProfilePath = `users/${userId}`;
        const [profileFiles] = await bucket.getFiles({ prefix: userProfilePath });
        const deleteProfilePromises = profileFiles.map(file => file.delete());
        await Promise.all(deleteProfilePromises);
        console.log(`Successfully deleted all files for user ${userId}`);
        response.status(200).send({ success: true });
    }
    catch (error) {
        console.error(`Error deleting files for user ${userId}:`, error);
        response.status(500).send({ error: 'Failed to delete user files' });
    }
});
/**
 * Cloud Function to automatically delete files from Storage when a story is deleted
 * This function triggers whenever a document in the 'stories' collection is deleted
 */
exports.cleanupStorageOnStoryDelete = (0, firestore_1.onDocumentDeleted)({
    region: 'nam5',
    document: 'stories/{storyId}'
}, async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    const bucket = admin.storage().bucket();
    try {
        if (data.mediaUrl) {
            console.log(`[cleanupStorageOnStoryDelete] mediaUrl: ${data.mediaUrl}`);
            // Extract the file path from the URL
            const filePath = data.mediaUrl.split('/o/')[1]?.split('?')[0];
            console.log(`[cleanupStorageOnStoryDelete] extracted filePath: ${filePath}`);
            if (filePath) {
                const decodedPath = decodeURIComponent(filePath);
                console.log(`[cleanupStorageOnStoryDelete] decodedPath: ${decodedPath}`);
                const file = bucket.file(decodedPath);
                const [exists] = await file.exists();
                console.log(`[cleanupStorageOnStoryDelete] file exists: ${exists}`);
                if (exists) {
                    await file.delete();
                    console.log(`[cleanupStorageOnStoryDelete] Deleted file: ${decodedPath}`);
                }
                else {
                    console.warn(`[cleanupStorageOnStoryDelete] File does not exist: ${decodedPath}`);
                }
            }
            else {
                console.warn('[cleanupStorageOnStoryDelete] Could not extract filePath from mediaUrl');
            }
        }
        else {
            console.warn('[cleanupStorageOnStoryDelete] No mediaUrl in story data');
        }
    }
    catch (error) {
        console.error(`[cleanupStorageOnStoryDelete] Error deleting file:`, error);
    }
});
exports.testHttp = (0, https_1.onRequest)((req, res) => {
    res.json({ message: 'Test function is working!' });
});
// Scheduled tasks
var restoreUserRoles_1 = require("./scheduled/restoreUserRoles");
Object.defineProperty(exports, "restoreUserRoles", { enumerable: true, get: function () { return restoreUserRoles_1.restoreUserRoles; } });
var cleanupExpiredStories_1 = require("./scheduled/cleanupExpiredStories");
Object.defineProperty(exports, "cleanupExpiredStories", { enumerable: true, get: function () { return cleanupExpiredStories_1.cleanupExpiredStories; } });
var deleteStoryAndFileHttp_1 = require("./admin/deleteStoryAndFileHttp");
Object.defineProperty(exports, "deleteStoryAndFileHttp", { enumerable: true, get: function () { return deleteStoryAndFileHttp_1.deleteStoryAndFileHttp; } });
//# sourceMappingURL=index.js.map