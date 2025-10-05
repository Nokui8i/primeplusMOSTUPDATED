import { db, auth } from '../firebase';
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, getDocs, orderBy, limit, serverTimestamp, increment } from 'firebase/firestore';
import type { UserProfile, Post, Comment, Subscription, Like } from '@/types/user';

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
    userId: user.uid,
    content,
    mediaUrl,
    createdAt: now,
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
export async function deletePost(postId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to delete posts');

  // Delete the post document
  await deleteDoc(doc(db, 'posts', postId));
  
  // Delete all comments for this post
  const commentsRef = collection(db, `posts/${postId}/comments`);
  const commentsSnapshot = await getDocs(commentsRef);
  const deletePromises = commentsSnapshot.docs.map(commentDoc => deleteDoc(commentDoc.ref));
  await Promise.all(deletePromises);
  
  // Delete all likes for this post
  const likesRef = collection(db, `posts/${postId}/likes`);
  const likesSnapshot = await getDocs(likesRef);
  const deleteLikePromises = likesSnapshot.docs.map(likeDoc => deleteDoc(likeDoc.ref));
  await Promise.all(deleteLikePromises);
}

export async function updatePost(postId: string, updates: Partial<Pick<Post, 'content' | 'mediaUrl'>>) {
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

export async function createNotification(notification: any): Promise<void> {
  // Placeholder implementation
  throw new Error('createNotification function not implemented');
}

export async function deleteNotification(notificationId: string): Promise<void> {
  // Placeholder implementation
  throw new Error('deleteNotification function not implemented');
} 