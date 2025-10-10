import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { onRequest, Request } from 'firebase-functions/v2/https';
import { Response } from 'express';
import * as admin from 'firebase-admin';
import { DocumentSnapshot } from 'firebase-admin/firestore';
import { UserRecord } from 'firebase-admin/auth';

// Import and re-export API handlers
import { plansApi } from './handlers/plan.handlers';
import { subscriptionsApi } from './handlers/subscription.handlers';

// Import and re-export Auth triggers
import { onUserCreate } from './triggers/authTriggers';

// Import and re-export Migration/Admin tasks
import { setupExistingUsers } from './migrations/setupExistingUsers';

// Import and re-export Follow triggers
import { onFollowWrite } from './triggers/followTriggers';

// Import and re-export Notification triggers
import { onLikeCreate, onCommentCreate, onFollowCreate } from './triggers/notificationTriggers';

import { deleteCreatorVerificationDataHttp } from './admin/supportActions';
import { sendNotificationHttp } from './admin/notifications';

interface MediaFile {
  path: string;
  [key: string]: any;
}

interface PostData {
  mediaFiles?: MediaFile[];
  thumbnailPath?: string;
  imagePath?: string;
  [key: string]: any;
}

/**
 * Cloud Function to automatically delete files from Storage when a post is deleted
 * This function triggers whenever a document in the 'posts' collection is deleted
 */
export const cleanupStorageOnPostDelete = onDocumentDeleted('posts/{postId}', async (event) => {
  const data = event.data?.data() as PostData;
  if (!data) return;

  const bucket = admin.storage().bucket();
  const deletedFiles: string[] = [];

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
  } catch (error) {
    console.error(`Error deleting files for post ${event.params.postId}:`, error);
    throw error;
  }
});

/**
 * Cloud Function to handle user deletion and cleanup
 * This function should be called by a Cloud Function trigger when a user is deleted
 */
export const cleanupStorageOnUserDelete = onRequest(async (request: Request, response: Response) => {
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
  } catch (error) {
    console.error(`Error deleting files for user ${userId}:`, error);
    response.status(500).send({ error: 'Failed to delete user files' });
  }
});

/**
 * Cloud Function to automatically delete files from Storage when a story is deleted
 * This function triggers whenever a document in the 'stories' collection is deleted
 */
export const cleanupStorageOnStoryDelete = onDocumentDeleted(
  {
    region: 'nam5',
    document: 'stories/{storyId}'
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

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
          } else {
            console.warn(`[cleanupStorageOnStoryDelete] File does not exist: ${decodedPath}`);
          }
        } else {
          console.warn('[cleanupStorageOnStoryDelete] Could not extract filePath from mediaUrl');
        }
      } else {
        console.warn('[cleanupStorageOnStoryDelete] No mediaUrl in story data');
      }
    } catch (error) {
      console.error(`[cleanupStorageOnStoryDelete] Error deleting file:`, error);
    }
  }
);

export const testHttp = onRequest((req, res) => {
  res.json({ message: 'Test function is working!' });
});

export { plansApi, subscriptionsApi, onUserCreate, setupExistingUsers, onFollowWrite, onLikeCreate, onCommentCreate, onFollowCreate, deleteCreatorVerificationDataHttp, sendNotificationHttp };

// Scheduled tasks
export { restoreUserRoles } from './scheduled/restoreUserRoles';
export { cleanupExpiredStories } from './scheduled/cleanupExpiredStories';
export { cleanupStreamThumbnails } from './scheduled/cleanupStreamThumbnails';
export { deleteStoryAndFileHttp } from './admin/deleteStoryAndFileHttp'; 