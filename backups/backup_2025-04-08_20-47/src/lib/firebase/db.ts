import { db, auth } from '../firebase';
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
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
export async function createComment(postId: string, content: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to comment');

  const now = new Date();
  const commentData: Omit<Comment, 'id'> = {
    postId,
    userId: user.uid,
    content,
    createdAt: now,
  };

  const commentRef = doc(collection(db, `posts/${postId}/comments`));
  await setDoc(commentRef, commentData);
  return { id: commentRef.id, ...commentData };
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
    const likeData: Like = {
      userId: user.uid,
      postId,
      createdAt: new Date(),
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
    tier,
    createdAt: now,
    expiresAt,
    status: 'active',
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