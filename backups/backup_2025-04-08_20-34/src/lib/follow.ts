import { db } from '@/lib/firebase';
import { collection, doc, deleteDoc, getDoc, getDocs, query, where, setDoc, increment, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

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

    const followId = `${user.uid}_${userId}`;
    const followRef = doc(db, 'follows', followId);

    const checkFollowStatus = async () => {
      const followDoc = await getDoc(followRef);
      setIsFollowing(followDoc.exists());
      setIsLoading(false);
    };

    checkFollowStatus();
  }, [user, userId]);

  const toggleFollow = async () => {
    if (!user || !userId) return;

    const followId = `${user.uid}_${userId}`;
    const followRef = doc(db, 'follows', followId);
    const batch = writeBatch(db);

    // Update follow document
    if (isFollowing) {
      batch.delete(followRef);
    } else {
      batch.set(followRef, {
        followerId: user.uid,
        followingId: userId,
        createdAt: new Date(),
      });
    }

    // Update user stats
    const followerRef = doc(db, 'users', userId);
    const followingRef = doc(db, 'users', user.uid);

    batch.update(followerRef, {
      followersCount: increment(isFollowing ? -1 : 1),
    });

    batch.update(followingRef, {
      followingCount: increment(isFollowing ? -1 : 1),
    });

    await batch.commit();
    setIsFollowing(!isFollowing);
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

    const fetchStats = async () => {
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();

      if (userData) {
        const isFollowing = user ? await checkIfFollowing(user.uid, userId) : false;
        setStats({
          followersCount: userData.followersCount || 0,
          followingCount: userData.followingCount || 0,
          isFollowing,
        });
      }
      setIsLoading(false);
    };

    fetchStats();
  }, [userId, user]);

  return { stats, isLoading };
};

const checkIfFollowing = async (followerId: string, followingId: string) => {
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