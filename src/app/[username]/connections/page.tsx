'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import { getFollowers, getFollowing } from '@/lib/follow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCard } from '@/components/user/UserCard';
import { Skeleton } from '@/components/ui/skeleton';
import { UserProfile } from '@/lib/types/user';

type ConnectionsPageParams = {
  [key: string]: string;
  username: string;
}

interface User extends Omit<UserProfile, 'uid'> {
  id: string;
  role: 'user' | 'creator' | 'admin';
  isVerified: boolean;
}

export default function ConnectionsPage() {
  const params = useParams<ConnectionsPageParams>();
  const username = params?.username;
  const [userId, setUserId] = useState<string | null>(null);
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserId = async () => {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setUserId(querySnapshot.docs[0].id);
      }
    };

    fetchUserId();
  }, [username]);

  useEffect(() => {
    const fetchConnections = async () => {
      if (!userId) return;

      try {
        // Fetch followers
        const followersList = await getFollowers(userId);
        const followersData = await Promise.all(
          followersList.map(async (follow) => {
            const userDoc = await getDoc(doc(db, 'users', follow.followerId));
            return {
              uid: userDoc.id,
              email: userDoc.data()?.email || '',
              username: userDoc.data()?.username || '',
              displayName: userDoc.data()?.displayName || 'Anonymous',
              photoURL: userDoc.data()?.photoURL || '',
              isAgeVerified: userDoc.data()?.isAgeVerified || false,
              status: userDoc.data()?.status || 'active',
              createdAt: userDoc.data()?.createdAt || Timestamp.now(),
              updatedAt: userDoc.data()?.updatedAt || Timestamp.now(),
              role: userDoc.data()?.role,
              isVerified: userDoc.data()?.isVerified || false,
              ...userDoc.data()
            } as unknown as UserProfile;
          })
        );
        setFollowers(followersData);

        // Fetch following
        const followingList = await getFollowing(userId);
        const followingData = await Promise.all(
          followingList.map(async (follow) => {
            const userDoc = await getDoc(doc(db, 'users', follow.followingId));
            return {
              uid: userDoc.id,
              email: userDoc.data()?.email || '',
              username: userDoc.data()?.username || '',
              displayName: userDoc.data()?.displayName || 'Anonymous',
              photoURL: userDoc.data()?.photoURL || '',
              isAgeVerified: userDoc.data()?.isAgeVerified || false,
              status: userDoc.data()?.status || 'active',
              createdAt: userDoc.data()?.createdAt || Timestamp.now(),
              updatedAt: userDoc.data()?.updatedAt || Timestamp.now(),
              role: userDoc.data()?.role,
              isVerified: userDoc.data()?.isVerified || false,
              ...userDoc.data()
            } as unknown as UserProfile;
          })
        );
        setFollowing(followingData);
      } catch (error) {
        console.error('Error fetching connections:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConnections();
  }, [userId]);

  if (loading) {
    return (
      <div className="container max-w-4xl py-8 space-y-8">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <Tabs defaultValue="followers" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="followers" className="flex-1">
            Followers ({followers.length})
          </TabsTrigger>
          <TabsTrigger value="following" className="flex-1">
            Following ({following.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="followers" className="mt-6 space-y-4">
          {followers.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
          {followers.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No followers yet
            </p>
          )}
        </TabsContent>
        <TabsContent value="following" className="mt-6 space-y-4">
          {following.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
          {following.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Not following anyone
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 