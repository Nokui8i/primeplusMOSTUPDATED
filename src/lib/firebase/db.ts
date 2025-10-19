import { db, auth } from '../firebase';
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, getDocs, orderBy, limit, serverTimestamp, increment, addDoc } from 'firebase/firestore';
import type { UserProfile, Comment, Subscription, Like } from '@/types/user';
import type { Post } from '@/lib/types/post';

// User Functions
export async function createUserProfile(userData: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to create profile');

  const now = new Date();
  const userProfile: UserProfile = {
    ...userData,
    uid: user.uid,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, 'users', user.uid), userProfile);
  return userProfile;
}

// Post Functions
export async function createPost(content: string, mediaUrl?: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to create post');

  const now = new Date();
  const postData: Omit<Post, 'id'> = {
    authorId: user.uid,
    content,
    mediaUrl,
    createdAt: now,
    type: 'text',
    isPublic: true,
    likes: 0,
    comments: 0,
    shares: 0,
    tags: [],
    taggedUsers: []
  };

  const postRef = doc(collection(db, 'posts'));
  await setDoc(postRef, postData);
  return { id: postRef.id, ...postData };
}

// Comment Functions
export async function createComment(postId: string, content: string, user?: any, parentId?: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Must be logged in to comment');

  // Get user profile data - always fetch from Firestore to get complete profile
  let userProfile = null;
  try {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    userProfile = userDoc.data();
    console.log('[createComment] Fetched user profile:', userProfile);
  } catch (error) {
    console.error('Error fetching user profile for comment:', error);
  }

  const now = new Date();
  const commentData: any = {
    postId,
    authorId: currentUser.uid,
    content,
    createdAt: now,
    authorDisplayName: userProfile?.displayName || userProfile?.username || 'Anonymous',
    authorUsername: userProfile?.username || 'Anonymous',
    authorPhotoURL: userProfile?.photoURL || null,
    parentId: parentId || null,
    likes: 0,
    isEdited: false
  };

  const commentRef = doc(collection(db, 'comments'));
  await setDoc(commentRef, commentData);
  
  console.log('[createComment] Comment created with data:', commentData);

  // Note: Notification creation for post author is now handled by Firebase trigger onCommentCreate
  // Only mention notifications are handled here for tagged users

  return { id: commentRef.id, ...commentData };
}

export async function deleteComment(postId: string, commentId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to delete comments');

  // Delete from main comments collection (consistent with createComment)
  await deleteDoc(doc(db, 'comments', commentId));
}

// Like Functions
export async function toggleLike(postId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to like posts');

  const likeRef = doc(db, `posts/${postId}/likes/${user.uid}`);
  const likeDoc = await getDoc(likeRef);

  if (likeDoc.exists()) {
    await deleteDoc(likeRef);
    return false; // Unlike
  } else {
    const likeData: Omit<Like, 'id'> = {
      userId: user.uid,
      postId,
      createdAt: serverTimestamp(),
    };
    await setDoc(likeRef, likeData);
    
    // Note: Notification creation is now handled by Firebase trigger onLikeCreate
    return true; // Like
  }
}

// Subscription Functions
export async function createSubscription(creatorId: string, tier?: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to subscribe');

  const now = new Date();
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month subscription

  const subscriptionData: Omit<Subscription, 'id'> = {
    subscriberId: user.uid,
    creatorId,
    planId: tier || 'default',
    status: 'active',
    startDate: now,
    endDate: expiresAt,
    createdAt: now,
    updatedAt: now,
  };

  const subscriptionRef = doc(collection(db, 'subscriptions'));
  await setDoc(subscriptionRef, subscriptionData);
  return { id: subscriptionRef.id, ...subscriptionData };
}

// Helper function to check if user is subscribed to a creator
export async function isSubscribedToCreator(creatorId: string) {
  const user = auth.currentUser;
  if (!user) return false;

  const q = query(
    collection(db, 'subscriptions'),
    where('subscriberId', '==', user.uid),
    where('creatorId', '==', creatorId),
    where('status', '==', 'active')
  );

  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
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

// Additional functions that were missing
export async function deletePost(postId: string, userId?: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to delete posts');

  try {
    // Get post data to find media URLs
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (!postDoc.exists()) {
      throw new Error('Post not found');
    }

    const postData = postDoc.data();
    console.log('[deletePost] Deleting post:', postId, 'with media:', postData.mediaUrl);

    // Delete media from storage if it exists
    if (postData.mediaUrl) {
      try {
        // Check if it's Firebase Storage or AWS S3
        if (postData.mediaUrl.includes('firebasestorage.googleapis.com')) {
          // Firebase Storage - extract path and delete
          console.log('[deletePost] Deleting from Firebase Storage');
          const { getStorage, ref: storageRef, deleteObject } = await import('firebase/storage');
          const storage = getStorage();
          
          // Extract the file path from the URL
          const urlParts = postData.mediaUrl.split('/o/')[1];
          if (urlParts) {
            const filePath = decodeURIComponent(urlParts.split('?')[0]);
            const fileRef = storageRef(storage, filePath);
            await deleteObject(fileRef);
            console.log('[deletePost] Deleted from Firebase Storage:', filePath);
          }
        } else if (postData.mediaUrl.includes('amazonaws.com') || postData.mediaUrl.includes('cloudfront.net')) {
          // AWS S3 - extract key and delete
          console.log('[deletePost] Deleting from AWS S3');
          // Extract the S3 key from the URL
          const urlObj = new URL(postData.mediaUrl);
          const s3Key = urlObj.pathname.substring(1); // Remove leading slash
          
          // Call backend API to delete from S3
          const response = await fetch('/api/delete-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: s3Key })
          });
          
          if (!response.ok) {
            console.error('[deletePost] Failed to delete from S3:', await response.text());
          } else {
            console.log('[deletePost] Deleted from S3:', s3Key);
          }
        }
        
        // Also delete thumbnail if exists
        if (postData.thumbnailUrl) {
          console.log('[deletePost] Deleting thumbnail:', postData.thumbnailUrl);
          // Same logic for thumbnail
          if (postData.thumbnailUrl.includes('firebasestorage.googleapis.com')) {
            const { getStorage, ref: storageRef, deleteObject } = await import('firebase/storage');
            const storage = getStorage();
            const urlParts = postData.thumbnailUrl.split('/o/')[1];
            if (urlParts) {
              const filePath = decodeURIComponent(urlParts.split('?')[0]);
              const fileRef = storageRef(storage, filePath);
              await deleteObject(fileRef);
              console.log('[deletePost] Deleted thumbnail from Firebase Storage');
            }
          } else if (postData.thumbnailUrl.includes('amazonaws.com') || postData.thumbnailUrl.includes('cloudfront.net')) {
            // AWS S3 thumbnail
            const urlObj = new URL(postData.thumbnailUrl);
            const s3Key = urlObj.pathname.substring(1);
            
            const response = await fetch('/api/delete-media', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: s3Key })
            });
            
            if (!response.ok) {
              console.error('[deletePost] Failed to delete thumbnail from S3');
            } else {
              console.log('[deletePost] Deleted thumbnail from S3');
            }
          }
        }
      } catch (storageError) {
        console.error('[deletePost] Error deleting media:', storageError);
        // Continue with post deletion even if media deletion fails
      }
    }

    // Delete the post document
    await deleteDoc(doc(db, 'posts', postId));
    console.log('[deletePost] Deleted post document');
    
    // Delete all comments for this post
    const commentsRef = collection(db, `posts/${postId}/comments`);
    const commentsSnapshot = await getDocs(commentsRef);
    const deletePromises = commentsSnapshot.docs.map(commentDoc => deleteDoc(commentDoc.ref));
    await Promise.all(deletePromises);
    console.log('[deletePost] Deleted comments:', commentsSnapshot.size);
    
    // Delete all likes for this post
    const likesRef = collection(db, `posts/${postId}/likes`);
    const likesSnapshot = await getDocs(likesRef);
    const deleteLikePromises = likesSnapshot.docs.map(likeDoc => deleteDoc(likeDoc.ref));
    await Promise.all(deleteLikePromises);
    console.log('[deletePost] Deleted likes:', likesSnapshot.size);

    console.log('[deletePost] Post deleted successfully');
  } catch (error) {
    console.error('[deletePost] Error:', error);
    throw error;
  }
}

export async function updatePost(postId: string, updates: Partial<Pick<Post, 'content' | 'mediaUrl' | 'isPublic' | 'accessSettings'>>) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to update posts');

  await updateDoc(doc(db, 'posts', postId), {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

// Missing exports that are being imported by other components
export async function uploadMedia(file: File, path: string, progress?: (progress: number) => void): Promise<string> {
  // Placeholder implementation - this should be implemented with Firebase Storage
  throw new Error('uploadMedia function not implemented');
}

export async function toggleSave(postId: string): Promise<boolean> {
  // Placeholder implementation
  throw new Error('toggleSave function not implemented');
}

export async function createNotification(notification: {
  type: 'like' | 'comment' | 'follow' | 'mention';
  fromUser: {
    uid: string;
    displayName: string;
    photoURL?: string;
    username?: string;
  };
  toUser: string;
  data?: any;
}): Promise<void> {
  try {
    const notificationData = {
      type: notification.type,
      fromUserId: notification.fromUser.uid,
      toUserId: notification.toUser,
      fromUser: {
        uid: notification.fromUser.uid,
        displayName: notification.fromUser.displayName,
        photoURL: notification.fromUser.photoURL || '',
        username: notification.fromUser.username || ''
      },
      read: false,
      data: notification.data || {},
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'notifications'), notificationData);
    console.log('🔔 Notification created:', notificationData);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
    console.log('🔔 Notification deleted:', notificationId);
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

export async function restoreNotification(notificationData: any): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...notificationData,
      // Use the original createdAt timestamp if provided, otherwise use current time
      createdAt: notificationData.createdAt || serverTimestamp()
    });
    console.log('🔔 Notification restored:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error restoring notification:', error);
    throw error;
  }
} 