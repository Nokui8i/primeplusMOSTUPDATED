import { db } from '@/lib/firebase/config';
import { collection, doc, deleteDoc, getDoc, getDocs, query, where, setDoc, increment, writeBatch, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

export interface FollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export const useFollowUser = (userId: string) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !userId) return;
    if (user.uid === userId) return;
    const followId = `${user.uid}_${userId}`;
    const followRef = doc(db, 'follows', followId);
    const unsub = onSnapshot(followRef, (followDoc) => {
      setIsFollowing(followDoc.exists());
      setIsLoading(false);
    });
    return () => unsub();
  }, [user, userId]);

  const toggleFollow = async () => {
    if (!user || !userId) return;
    if (user.uid === userId) return;
    const followId = `${user.uid}_${userId}`;
    const followRef = doc(db, 'follows', followId);
    const followerRef = doc(db, 'users', userId);
    const followingRef = doc(db, 'users', user.uid);
    const batch = writeBatch(db);
    const followDoc = await getDoc(followRef);
    if (followDoc.exists()) {
      // Only decrement if currently following and count > 0
      batch.delete(followRef);
      batch.update(followerRef, {
        followersCount: increment(-1),
      });
      batch.update(followingRef, {
        followingCount: increment(-1),
      });
    } else {
      batch.set(followRef, {
        followerId: user.uid,
        followingId: userId,
        createdAt: new Date(),
      });
      batch.update(followerRef, {
        followersCount: increment(1),
      });
      batch.update(followingRef, {
        followingCount: increment(1),
      });
    }
    try {
      await batch.commit();
    } catch (err) {
      console.error('[Follow] Error committing batch:', err);
    }
  };

  return { isFollowing, isLoading, toggleFollow };
};

export const useFollowStats = (userId: string) => {
  const [stats, setStats] = useState<FollowStats>({
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, 'users', userId), async (userDoc) => {
      const userData = userDoc.data();
      let isFollowing = false;
      if (user && user.uid !== userId) {
        // Check if following in parallel
        const followDoc = await getDoc(doc(db, 'follows', `${user.uid}_${userId}`));
        isFollowing = followDoc.exists();
      }
      if (userData) {
        setStats({
          followersCount: userData.followersCount || 0,
          followingCount: userData.followingCount || 0,
          isFollowing,
        });
      }
      setIsLoading(false);
    });
    return () => unsub();
  }, [userId, user]);

  return { stats, isLoading };
};

const checkIfFollowing = async (followerId: string, followingId: string) => {
  if (followerId === followingId) return false;
  const followDoc = await getDoc(doc(db, 'follows', `${followerId}_${followingId}`));
  return followDoc.exists();
};

export const getFollowers = async (userId: string) => {
  const q = query(collection(db, 'follows'), where('followingId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Follow[];
};

export const getFollowing = async (userId: string) => {
  const q = query(collection(db, 'follows'), where('followerId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Follow[];
}; 