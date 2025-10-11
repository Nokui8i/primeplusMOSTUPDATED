"use strict";
/**
 * Scheduled function to clean up thumbnails from ended live streams
 * Runs daily and deletes thumbnails from streams that:
 * - Ended more than 24 hours ago
 * - Were not saved as posts
 */
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
exports.cleanupStreamThumbnails = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const client_s3_1 = require("@aws-sdk/client-s3");
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});
exports.cleanupStreamThumbnails = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
    const db = admin.firestore();
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    try {
        console.log('Starting stream thumbnail cleanup...');
        // Get all ended streams older than 24 hours
        const streamsSnapshot = await db.collection('streams')
            .where('status', '==', 'ended')
            .where('endedAt', '<', oneDayAgo)
            .get();
        console.log(`Found ${streamsSnapshot.size} ended streams to check`);
        let deletedCount = 0;
        let skippedCount = 0;
        for (const streamDoc of streamsSnapshot.docs) {
            const streamData = streamDoc.data();
            const streamId = streamDoc.id;
            // Check if stream was saved as post
            const postId = `post_${streamId}`;
            const postDoc = await db.collection('posts').doc(postId).get();
            if (postDoc.exists) {
                console.log(`Stream ${streamId} was saved as post, keeping thumbnail`);
                skippedCount++;
                continue;
            }
            // Delete thumbnail from S3 if it exists
            if (streamData.thumbnail) {
                try {
                    const thumbnailUrl = streamData.thumbnail;
                    // Extract S3 key from URL
                    const urlParts = thumbnailUrl.split('/');
                    const key = urlParts.slice(3).join('/');
                    const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || '';
                    if (!bucketName) {
                        console.error('S3 bucket not configured');
                        continue;
                    }
                    const command = new client_s3_1.DeleteObjectCommand({
                        Bucket: bucketName,
                        Key: key,
                    });
                    await s3Client.send(command);
                    console.log(`Deleted thumbnail from S3: ${key}`);
                    // Update stream document to clear thumbnail reference
                    await streamDoc.ref.update({
                        thumbnail: null,
                        thumbnailDeletedAt: now,
                    });
                    deletedCount++;
                }
                catch (error) {
                    console.error(`Error deleting thumbnail for stream ${streamId}:`, error);
                }
            }
        }
        console.log(`Cleanup complete. Deleted: ${deletedCount}, Skipped: ${skippedCount}`);
        return {
            success: true,
            deletedCount,
            skippedCount,
            totalProcessed: streamsSnapshot.size,
        };
    }
    catch (error) {
        console.error('Error during stream thumbnail cleanup:', error);
        throw error;
    }
});
//# sourceMappingURL=cleanupStreamThumbnails.js.map