import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Scheduled function to clean up expired stories and their files every hour
export const cleanupExpiredStories = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const db = getFirestore();
    const storage = getStorage().bucket();
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
          } catch (err) {
            console.warn('[cleanupExpiredStories] Failed to delete media file from storage:', err);
          }
        }
      }
      console.log(`[cleanupExpiredStories] Deleted ${deletedCount} expired stories.`);
      return null;
    } catch (error) {
      console.error('[cleanupExpiredStories] Error deleting expired stories:', error);
      throw error;
    }
  }); 