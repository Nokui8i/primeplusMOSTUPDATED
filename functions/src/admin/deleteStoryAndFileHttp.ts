// DEBUG: Return all story IDs and count for debugging (no storyId required, v2-debug-final-2025-05-26)
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

export const deleteStoryAndFileHttp = onRequest({ 
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
    const db = getFirestore();
    const bucket = getStorage().bucket();

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
      } catch (storageError) {
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
  } catch (error) {
    console.error('[deleteStoryAndFileHttp] Error:', error);
    res.status(500).json({ 
      error: 'Failed to delete story',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}); 