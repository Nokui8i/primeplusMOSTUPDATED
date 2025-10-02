'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { getFollowers, getFollowing } from '@/lib/follow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCard } from '@/components/user/UserCard';
import { Skeleton } from '@/components/ui/skeleton';

interface User {
  id: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
}

export default function ConnectionsPage() {
  const { username } = useParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
              id: userDoc.id,
              ...userDoc.data(),
            } as User;
          })
        );
        setFollowers(followersData);

        // Fetch following
        const followingList = await getFollowing(userId);
        const followingData = await Promise.all(
          followingList.map(async (follow) => {
            const userDoc = await getDoc(doc(db, 'users', follow.followingId));
            return {
              id: userDoc.id,
              ...userDoc.data(),
            } as User;
          })
        );
        setFollowing(followingData);
      } catch (error) {
        console.error('Error fetching connections:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConnections();
  }, [userId]);

  if (isLoading) {
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