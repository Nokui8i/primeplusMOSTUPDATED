/**
 * �� PROTECTED DATABASE OPERATIONS
 * 
 * These functions handle core database operations. Modifications require:
 * 1. Explicit approval from the project maintainer
 * 2. Security review
 * 3. Testing of all affected operations
 * 4. Documentation updates in CHANGELOG.md
 * 
 * Protected Operations:
 * - Post creation and updates
 * - Comment creation and updates
 * - Like operations
 * - Notification handling
 * - User profile updates
 * 
 * Last Modified: 2024-04-08
 * Version: stable-v1.0
 */

import { db, auth, storage } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  serverTimestamp, 
  writeBatch, 
  increment, 
  Timestamp, 
  addDoc, 
  runTransaction 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable, deleteObject } from 'firebase/storage';
import type { UserProfile } from '@/types/user';
import { User } from "firebase/auth"
import { Post, Comment, Like, PostType } from '@/lib/types/post'
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// User Functions
export async function createUserProfile(userData: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt' | 'status'>) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to create profile');

  const userProfile: UserProfile = {
    ...userData,
    uid: user.uid,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active'
  };

  await setDoc(doc(db, 'users', user.uid), userProfile);
  return userProfile;
}

export async function getUserProfile(userId: string) {
  const userDoc = await getDoc(doc(db, 'users', userId));
  return userDoc.exists() ? userDoc.data() : null;
}

// Notification Functions
export async function createNotification(type: 'like' | 'comment' | 'mention', fromUser: any, toUserId: string, data: any) {
  
  if (!fromUser || !toUserId || fromUser.uid === toUserId) {
    return;
  }

  try {
    // Get the user's profile and notification settings
    const userDoc = await getDoc(doc(db, 'users', toUserId));
    const userData = userDoc.data();
    
    if (!userData) {
      return;
    }

    // Get notification settings
    const pushSettings = userData.notifications?.push || {
      likes: true,
      comment: true,
      mention: true
    };

    // Map notification type to setting key
    const typeToSetting: { [key: string]: string } = {
      'like': 'likes',
      'comment': 'comment',
      'mention': 'mention'
    };

    const settingKey = typeToSetting[type];
    if (!settingKey) {
      return;
    }

    // Check if notifications are enabled for this type
    const allowed = pushSettings[settingKey] !== false; // Default to true if not set

    if (!allowed) {
      return;
    }

    // Create notification data
    const notification = {
      type,
      fromUser: {
        uid: fromUser.uid,
        displayName: fromUser.displayName || 'Anonymous',
        photoURL: fromUser.photoURL || null,
        username: fromUser.username || null
      },
      toUserId,
      data,
      createdAt: serverTimestamp(),
      read: false
    };

    // Add the notification to the user's notifications subcollection
    const userNotificationsRef = collection(db, `users/${toUserId}/notifications`);
    const docRef = await addDoc(userNotificationsRef, notification);

    // Also add it to the global notifications collection
    const notificationsRef = collection(db, 'notifications');
    const globalDocRef = await addDoc(notificationsRef, notification);

    return docRef.id;
  } catch (error) {
    console.error('[ERROR] Failed to create notification:', error);
    throw error;
  }
}

// Comment Functions
export async function createComment(postId: string, content: string, user: any, parentCommentId?: string) {
  console.log('[createComment] Starting with postId:', postId, 'content:', content, 'user:', user?.uid, 'parentCommentId:', parentCommentId);
  
  if (!user) throw new Error('Must be logged in to comment');

  try {
    // Get user profile to ensure we have the latest display name
    const userProfileDoc = await getDoc(doc(db, 'users', user.uid));
    const userProfile = userProfileDoc.data();
    
    // Use the most appropriate display name available
    const displayName = userProfile?.displayName || user.displayName || user.nickname || 'Anonymous User';
    
    // Get post and its data
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (!postDoc.exists()) {
      throw new Error('Post not found');
    }
    
    const postData = postDoc.data();
    if (!postData.authorId) {
      console.error('Post data structure:', postData);
      throw new Error('Post author not found');
    }

    console.log('[createComment] Post found, authorId:', postData.authorId);

    // If this is a reply, get the parent comment data
    let parentCommentData;
    let parentCommentAuthorId;
    if (parentCommentId) {
      const parentCommentRef = doc(db, `posts/${postId}/comments/${parentCommentId}`);
      const parentCommentSnap = await getDoc(parentCommentRef);
      if (parentCommentSnap.exists()) {
        parentCommentData = parentCommentSnap.data();
        parentCommentAuthorId = parentCommentData.authorId;
      }
    }

    // Start a batch write for atomic operations
    const batch = writeBatch(db);

    // Create comment document
    const commentsRef = collection(db, `posts/${postId}/comments`);
    const commentRef = doc(commentsRef);
    const commentDocData = {
      content: content.trim(),
      authorId: user.uid,
      authorDisplayName: displayName,
      authorPhotoURL: user.photoURL || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      likes: 0,
      isEdited: false,
      parentId: parentCommentId || null // Add parent comment reference
    };
    
    console.log('[createComment] Creating comment with data:', commentDocData);
    batch.set(commentRef, commentDocData);

    // Update post comments count in batch
    const postUpdateData = {
      comments: increment(1),
      updatedAt: serverTimestamp()
    };
    batch.update(doc(db, 'posts', postId), postUpdateData);

    console.log('[createComment] Updating post with data:', postUpdateData);

    // Commit the batch to ensure atomicity
    try {
      await batch.commit();
      console.log('[createComment] Batch committed successfully, comment ID:', commentRef.id);
    } catch (batchError) {
      // Add visible error log and show the fields being updated
      console.error('[createComment] Batch commit failed:', batchError);
      console.error('[createComment] Comment doc data:', commentDocData);
      console.error('[createComment] Post update data:', postUpdateData);
      if (batchError && typeof batchError === 'object' && 'message' in batchError) {
        console.error('[createComment] Error message:', (batchError as Error).message);
      }
      throw batchError;
    }

    // Create notifications
    const notificationPromises = [];

    // 1. Notify post author if commenter is not the post author
    if (postData.authorId !== user.uid) {
      notificationPromises.push(
        createNotification('comment', {
          uid: user.uid,
          displayName: displayName,
          photoURL: user.photoURL || '',
          nickname: userProfile?.nickname || ''
        }, postData.authorId, {
          postId,
          commentId: commentRef.id,
          text: content.trim().length > 100 ? content.trim().substring(0, 100) + '...' : content.trim(),
          contentType: postData.type === 'image' ? 'photo' : 'post',
          isReply: !!parentCommentId
        })
      );
    }

    // 2. If this is a reply, notify the parent comment author
    // (only if they're different from both the post author and current commenter)
    if (parentCommentId && parentCommentAuthorId && 
        parentCommentAuthorId !== user.uid && 
        parentCommentAuthorId !== postData.authorId) {
      notificationPromises.push(
        createNotification('comment', {
          uid: user.uid,
          displayName: displayName,
          photoURL: user.photoURL || '',
          nickname: userProfile?.nickname || ''
        }, parentCommentAuthorId, {
          postId,
          commentId: commentRef.id,
          parentCommentId,
          text: content.trim().length > 100 ? content.trim().substring(0, 100) + '...' : content.trim(),
          contentType: 'reply',
          isReply: true
        })
      );
    }

    // Wait for all notifications to be created
    if (notificationPromises.length > 0) {
      await Promise.all(notificationPromises);
    }

    // Debug: log postRef path and current comments value/type
    const postDocDebug = await getDoc(doc(db, 'posts', postId));
    if (postDocDebug.exists()) {
      const data = postDocDebug.data();
    } else {
    }
    // Test: try direct update (uncomment to test)
    // try {
    //   await updateDoc(doc(db, 'posts', postId), { comments: increment(1), updatedAt: serverTimestamp() });
    // } catch (directError) {
    //   console.error('[DEBUG] Direct updateDoc increment(1) failed:', directError);
    // }

    return commentRef.id;
  } catch (error) {
    console.error('Error in createComment:', error);
    throw error;
  }
}

// Like Functions
export const toggleLike = async (
  path: string,  // Can be either 'posts/postId' or 'posts/postId/comments/commentId'
  userId: string,
  displayName: string,
  photoURL: string
): Promise<boolean> => {
  try {
    // Split path into segments and remove empty strings
    const pathSegments = path.split('/').filter(segment => segment.length > 0);
    
    // Validate path format
    if (pathSegments[0] !== 'posts' || pathSegments.length < 2) {
      throw new Error('Invalid path format. Must start with "posts/"');
    }

    const postId = pathSegments[1];
    const isComment = pathSegments.length > 2 && pathSegments[2] === 'comments';
    const commentId = isComment ? pathSegments[3] : undefined;

    // Get the document reference based on the path
    const docRef = isComment && commentId
      ? doc(db, 'posts', postId, 'comments', commentId)
      : doc(db, 'posts', postId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Document not found');
    }

    const docData = docSnap.data();
    if (!docData) {
      throw new Error('Document data is empty');
    }

    // Get the like reference
    const likeRef = isComment && commentId
      ? doc(db, 'posts', postId, 'comments', commentId, 'likes', userId)
      : doc(db, 'posts', postId, 'likes', userId);
    const likeSnap = await getDoc(likeRef);
    const isLiked = likeSnap.exists();

    const batch = writeBatch(db);

    if (isLiked) {
      // Unlike
      batch.delete(likeRef);
      batch.update(docRef, {
        likes: increment(-1),
        updatedAt: serverTimestamp()
      });
    } else {
      // Like
      batch.set(likeRef, {
        userId,
        displayName,
        photoURL,
        createdAt: serverTimestamp()
      });
      batch.update(docRef, {
        likes: increment(1),
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();

    // Handle notifications
    const authorId = docData.authorId;
    if (!authorId) {
      throw new Error('Author ID not found');
    }

    if (authorId !== userId) {
      try {
        if (isLiked) {
          // Delete the like notification
          const notificationsRef = collection(db, 'notifications');
          let q = query(
            notificationsRef,
            where('type', '==', 'like'),
            where('fromUser.uid', '==', userId),
            where('toUserId', '==', authorId),
            where('data.postId', '==', postId)
          );
          
          if (commentId) {
            q = query(q, where('data.commentId', '==', commentId));
          }
          
          const notificationSnapshot = await getDocs(q);
          if (!notificationSnapshot.empty) {
            const deleteBatch = writeBatch(db);
            notificationSnapshot.forEach((doc) => {
              deleteBatch.delete(doc.ref);
            });
            await deleteBatch.commit();
          }
        } else {
          // Create a new like notification
          const notificationData: {
            postId: string;
            contentType: string;
            commentId?: string;
          } = {
            postId,
            contentType: isComment ? 'comment' : 'post'
          };
          
          // Only include commentId if it's a comment like
          if (commentId) {
            notificationData.commentId = commentId;
          }

          await createNotification('like', {
            uid: userId,
            displayName,
            photoURL
          }, authorId, notificationData);
        }
      } catch (error) {
        console.error('Error handling notification:', error);
        // Don't throw here - the like operation was successful
      }
    }

    return !isLiked;
  } catch (error) {
    console.error('Error toggling like:', error);
    throw error;
  }
};

// Save Functions
export async function toggleSave(postId: string, userId: string) {
  const saveRef = doc(db, `users/${userId}/saves/${postId}`);
  try {
    await setDoc(saveRef, {
      postId,
      savedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error toggling save:', error);
    throw error;
  }
}

export interface FeaturedPost {
  id: string;
  title: string;
  author: {
    name: string;
    avatar: string;
  };
  thumbnail: string;
  preview: string;
  createdAt: Date;
}

export async function getFeaturedPosts(): Promise<FeaturedPost[]> {
  try {
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      // Return empty array if no posts exist yet
      return [];
    }

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as FeaturedPost[];
  } catch (error) {
    console.error('Error fetching featured posts:', error);
    return []; // Return empty array on error
  }
}

// Posts
export async function createPost(postData: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to create posts');

  const postRef = doc(collection(db, 'posts'));
  const now = Timestamp.now();

  // Ensure all required fields are set with proper types
  const post: Omit<Post, 'id'> = {
    authorId: user.uid,
    content: postData.content || '',
    type: postData.type || 'text',
    isPublic: postData.isPublic ?? true,
    createdAt: now,
    updatedAt: now,
    likes: 0,
    comments: 0,
    shares: 0,
    tags: postData.tags || [],
    taggedUsers: postData.taggedUsers || [],
    mediaUrl: postData.mediaUrl || undefined,
    thumbnailUrl: postData.thumbnailUrl || undefined,
    location: postData.location || undefined,
    vrSettings: postData.vrSettings || undefined,
    storySettings: postData.storySettings || undefined,
    accessSettings: postData.accessSettings || undefined
  };

  try {
    await setDoc(postRef, post);
    return postRef.id;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
}

export const getPost = async (postId: string) => {
  const postDoc = await getDoc(doc(db, 'posts', postId))
  if (!postDoc.exists()) return null
  return { id: postDoc.id, ...postDoc.data() } as Post
}

export const getPosts = async (userId?: string, type?: PostType, limitCount = 10) => {
  let q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(limitCount))
  if (userId) q = query(q, where('authorId', '==', userId))
  if (type) q = query(q, where('type', '==', type))
  
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[]
}

export const updatePost = async (postId: string, data: Partial<Post>) => {
  await updateDoc(doc(db, 'posts', postId), {
    ...data,
    updatedAt: serverTimestamp()
  })
}

export async function deletePost(postId: string, userId: string) {
  if (!postId || !userId) {
    throw new Error('Post ID and User ID are required');
  }

  const postRef = doc(db, 'posts', postId);
  const postDoc = await getDoc(postRef);
  
  if (!postDoc.exists()) {
    throw new Error('Post not found');
  }

  const postData = postDoc.data();
  if (!postData || !postData.authorId) {
    throw new Error('Invalid post data');
  }

  if (postData.authorId !== userId) {
    throw new Error('You do not have permission to delete this post');
  }

  try {
    // Start a batch write for atomic operations
    const batch = writeBatch(db);

    // 1. Delete all comments and their replies
    const commentsRef = collection(db, `posts/${postId}/comments`);
    const commentsSnapshot = await getDocs(commentsRef);
    
    // Delete all comments and their replies
    commentsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 2. Delete all likes
    const likesRef = collection(db, `posts/${postId}/likes`);
    const likesSnapshot = await getDocs(likesRef);
    likesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 3. Delete the post document
    batch.delete(postRef);

    // Commit the batch
    await batch.commit();

    // 4. Delete all notifications related to this post
    const notificationsRef = collection(db, 'notifications');
    const notificationsQuery = query(
      notificationsRef,
      where('data.postId', '==', postId)
    );
    const notificationsSnapshot = await getDocs(notificationsQuery);
    
    if (!notificationsSnapshot.empty) {
      const notificationsBatch = writeBatch(db);
      notificationsSnapshot.forEach((doc) => {
        notificationsBatch.delete(doc.ref);
      });
      await notificationsBatch.commit();
    }

    // 5. Delete media files from Storage
    const storageRef = ref(storage);
    const deletedFiles: string[] = [];

    // Delete main media file
    if (postData.mediaUrl) {
      try {
        // Check if it's an AWS CloudFront URL
        if (postData.mediaUrl.includes('cloudfront.net')) {
          // Delete from AWS S3
          const { deleteFromS3, extractS3KeyFromUrl } = await import('@/lib/aws/s3');
          const s3Key = extractS3KeyFromUrl(postData.mediaUrl);
          if (s3Key) {
            await deleteFromS3(s3Key);
            deletedFiles.push(postData.mediaUrl);
          }
        } else {
          // Delete from Firebase Storage (for legacy files)
          const mediaRef = ref(storage, postData.mediaUrl);
          await deleteObject(mediaRef);
          deletedFiles.push(postData.mediaUrl);
        }
      } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
          console.error('Error deleting main media file:', error);
        }
        // else: ignore
      }
    }

    // Delete thumbnail if exists
    if (postData.thumbnailUrl) {
      try {
        // Check if it's an AWS CloudFront URL
        if (postData.thumbnailUrl.includes('cloudfront.net')) {
          // Delete from AWS S3
          const { deleteFromS3, extractS3KeyFromUrl } = await import('@/lib/aws/s3');
          const s3Key = extractS3KeyFromUrl(postData.thumbnailUrl);
          if (s3Key) {
            await deleteFromS3(s3Key);
            deletedFiles.push(postData.thumbnailUrl);
          }
        } else {
          // Delete from Firebase Storage (for legacy files)
          const thumbnailRef = ref(storage, postData.thumbnailUrl);
          await deleteObject(thumbnailRef);
          deletedFiles.push(postData.thumbnailUrl);
        }
      } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
          console.error('Error deleting thumbnail:', error);
        }
        // else: ignore
      }
    }

    // Delete additional media files if they exist (check both mediaFiles and mediaUrls)
    const mediaFilesToDelete = [];
    
    // Check mediaFiles array (legacy format)
    if (postData.mediaFiles && Array.isArray(postData.mediaFiles)) {
      mediaFilesToDelete.push(...postData.mediaFiles.map(f => f.path).filter(Boolean));
    }
    
    // Check mediaUrls array (current format)
    if (postData.mediaUrls && Array.isArray(postData.mediaUrls)) {
      mediaFilesToDelete.push(...postData.mediaUrls);
    }
    
    // Delete all media files
    for (const fileUrl of mediaFilesToDelete) {
      if (fileUrl) {
        try {
          // Check if it's an AWS CloudFront URL
          if (fileUrl.includes('cloudfront.net')) {
            // Delete from AWS S3
            const { deleteFromS3, extractS3KeyFromUrl } = await import('@/lib/aws/s3');
            const s3Key = extractS3KeyFromUrl(fileUrl);
            if (s3Key) {
              await deleteFromS3(s3Key);
              deletedFiles.push(fileUrl);
            }
          } else {
            // Delete from Firebase Storage (for legacy files)
            const fileRef = ref(storage, fileUrl);
            await deleteObject(fileRef);
            deletedFiles.push(fileUrl);
          }
        } catch (error: any) {
          if (error.code !== 'storage/object-not-found') {
            console.error('Error deleting media file:', error);
          }
          // else: ignore
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
}

// Comments
export const createPostComment = async (commentData: Omit<Comment, 'id' | 'createdAt' | 'updatedAt' | 'likes'>) => {
  if (!commentData.authorId) {
    throw new Error('Author ID is required');
  }

  // Get user profile for display name and photo URL
  const userProfileDoc = await getDoc(doc(db, 'users', commentData.authorId));
  const userProfile = userProfileDoc.data();
  
  // Get post to verify it exists and get author ID
  const postDoc = await getDoc(doc(db, 'posts', commentData.postId));
  if (!postDoc.exists()) {
    throw new Error('Post not found');
  }
  
  const postData = postDoc.data();
  if (!postData.authorId) {
    throw new Error('Post author not found');
  }

  // Start a batch write for atomic operations
  const batch = writeBatch(db);

  // Create comment document in the post's comments subcollection
  const commentRef = doc(collection(db, `posts/${commentData.postId}/comments`));
  
  // Add comment to batch with all required fields
  batch.set(commentRef, {
    content: commentData.content.trim(),
    authorId: commentData.authorId,
    author: {
      displayName: userProfile?.displayName || 'Anonymous User',
      username: userProfile?.username || '',
      photoURL: userProfile?.photoURL || ''
    },
    likes: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // Update post comments count in batch
  batch.update(doc(db, 'posts', commentData.postId), {
    comments: increment(1),
    updatedAt: serverTimestamp()
  });

  try {
    // Commit the batch to ensure atomicity
    await batch.commit();

    // Create notification for post author if it's not the same user
    if (postData.authorId !== commentData.authorId) {
      const notificationData = {
        postId: commentData.postId,
        commentId: commentRef.id,
        text: commentData.content.trim().length > 100 
          ? commentData.content.trim().substring(0, 100) + '...' 
          : commentData.content.trim(),
        contentType: postData.type === 'image' ? 'photo' : 'post',
        isReply: false
      };

      await createNotification('comment', {
        uid: commentData.authorId,
        displayName: userProfile?.displayName || 'Anonymous User',
        photoURL: userProfile?.photoURL || '',
        nickname: userProfile?.nickname || ''
      }, postData.authorId, notificationData);
    }

    return commentRef.id;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
}

export const getPostComments = async (postId: string, limitCount = 10) => {
  const q = query(
    collection(db, 'comments'),
    where('postId', '==', postId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  )
  
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Comment[]
}

export const updateComment = async (commentId: string, data: Partial<Comment>) => {
  await updateDoc(doc(db, 'comments', commentId), {
    ...data,
    updatedAt: serverTimestamp()
  })
}

export async function deleteComment(postId: string, commentId: string, userId: string): Promise<boolean> {
  try {
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const postRef = doc(db, 'posts', postId);
    // Fetch both comment and post data in parallel
    const [commentDoc, postDoc] = await Promise.all([
      getDoc(commentRef),
      getDoc(postRef)
    ]);
    if (!commentDoc.exists() || !postDoc.exists()) {
      throw new Error('Comment or post not found');
    }
    const commentData = commentDoc.data();
    const postData = postDoc.data();
    // Check if user is either the comment author or post author
    if (commentData.authorId !== userId && postData.authorId !== userId) {
      throw new Error('You do not have permission to delete this comment');
    }
    // Get all replies to this comment
    const repliesQuery = query(
      collection(db, 'posts', postId, 'comments'),
      where('parentId', '==', commentId)
    );
    const repliesSnapshot = await getDocs(repliesQuery);
    const replyCount = repliesSnapshot.size;
    // Delete the comment and all its replies
    // Delete related notifications
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('data.postId', '==', postId),
      where('data.commentId', 'in', [commentId, ...repliesSnapshot.docs.map(doc => doc.id)])
    );
    const notificationsSnapshot = await getDocs(notificationsQuery);
    // Use a transaction to ensure the counter never goes below zero
    await runTransaction(db, async (transaction) => {
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) throw new Error('Post not found');
      const currentCount = postSnap.data().comments || 0;
      const totalCommentsToDelete = replyCount + 1;
      const newCount = Math.max(0, currentCount - totalCommentsToDelete);
      transaction.update(postRef, {
        comments: newCount,
        updatedAt: serverTimestamp()
      });
      transaction.delete(commentRef);
      repliesSnapshot.forEach((doc) => {
        transaction.delete(doc.ref);
      });
      notificationsSnapshot.forEach((doc) => {
        transaction.delete(doc.ref);
      });
    });
    return true;
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
}

// Helper function to check if a user has liked a post
export const hasLikedPost = async (postId: string, userId: string): Promise<boolean> => {
  if (!userId) return false;
  const likeRef = doc(db, `posts/${postId}/likes/${userId}`);
  const likeSnap = await getDoc(likeRef);
  return likeSnap.exists();
}

// Helper function to get post likes count
export const getPostLikes = async (postId: string): Promise<number> => {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  return postSnap.exists() ? (postSnap.data()?.likes || 0) : 0;
}

// Media upload - Now uses AWS S3 instead of Firebase Storage
export async function uploadMedia(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Import AWS upload function
  const { uploadMedia: uploadToS3 } = await import('@/lib/aws/upload');
  return uploadToS3(file, onProgress);
}

// Helper function to delete notifications
export const deleteNotification = async (type: 'like' | 'comment', fromUserId: string, toUserId: string, postId: string, commentId?: string) => {
  try {
    const notificationsRef = collection(db, 'notifications');
    let q = query(
      notificationsRef,
      where('type', '==', type),
      where('fromUser.uid', '==', fromUserId),
      where('toUserId', '==', toUserId),
      where('data.postId', '==', postId)
    );

    if (commentId) {
      q = query(q, where('data.commentId', '==', commentId));
    }

    const notificationSnapshot = await getDocs(q);
    if (!notificationSnapshot.empty) {
      const batch = writeBatch(db);
      notificationSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

export async function cleanupOrphanedPostCollections(postId: string) {
  try {
    const batch = writeBatch(db);
    
    // Clean up comments
    const commentsRef = collection(db, `posts/${postId}/comments`);
    const commentsSnapshot = await getDocs(commentsRef);
    commentsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Clean up likes
    const likesRef = collection(db, `posts/${postId}/likes`);
    const likesSnapshot = await getDocs(likesRef);
    likesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Commit the batch
    if (commentsSnapshot.size > 0 || likesSnapshot.size > 0) {
      await batch.commit();
    }

    return true;
  } catch (error) {
    console.error('Error cleaning up orphaned collections:', error);
    return false;
  }
}

// Helper function to check if user is subscribed to a creator
export async function isSubscribedToCreator(creatorId: string) {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    // Query for both active and cancelled subscriptions
    const q = query(
      collection(db, 'subscriptions'),
      where('subscriberId', '==', user.uid),
      where('creatorId', '==', creatorId),
      where('status', 'in', ['active', 'cancelled'])
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return false;

    // Check if any subscription is active or cancelled but still valid
    const now = new Date();
    return querySnapshot.docs.some(doc => {
      const data = doc.data();
      const isActive = data.status === 'active';
      const isCancelledButValid = data.status === 'cancelled' && 
        data.endDate && 
        (data.endDate.toDate ? data.endDate.toDate() : new Date(data.endDate)) > now;
      return isActive || isCancelledButValid;
    });
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return false;
  }
} 