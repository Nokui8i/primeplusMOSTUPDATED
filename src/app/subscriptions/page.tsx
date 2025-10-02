'use client';

import { useEffect, useState } from 'react';
import { CreatorCard } from '@/components/user/CreatorCard';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { UserSubscription } from '../../types/subscription';
import { CreatorProfile } from '@/types/user';
import { Post } from '@/components/Post';
import { Post as PostType } from '@/lib/types/post';
import { Badge } from '@/components/ui/badge';
import { UserCard } from '@/components/user/UserCard';

interface UserList {
  name: string;
  count: number;
  users: CreatorProfile[];
}

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const [userLists, setUserLists] = useState<UserList[]>([
    { name: 'Subscribed', count: 0, users: [] },
    { name: 'Expired', count: 0, users: [] },
  ]);
  const [selectedList, setSelectedList] = useState('Subscribed');
  const [tab, setTab] = useState('userlists');
  const [userFilter, setUserFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<CreatorProfile | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [postTypeFilter, setPostTypeFilter] = useState('all');

  useEffect(() => {
    async function fetchUserLists() {
      if (!user) return;
      // Only fetch subscriptions
      const subscriptionsQuery = query(
        collection(db, 'subscriptions'),
        where('subscriberId', '==', user.uid),
        where('status', 'in', ['active', 'cancelled'])
      );
      const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
      const now = new Date();
      const subscribedUsers: CreatorProfile[] = [];
      const expiredUsers: CreatorProfile[] = [];
      for (const subDoc of subscriptionsSnapshot.docs) {
        const sub = subDoc.data();
        const creatorRef = doc(db, 'users', sub.creatorId);
        const creatorSnap = await getDoc(creatorRef);
        if (!creatorSnap.exists()) continue;
        const creator = { uid: creatorSnap.id, ...creatorSnap.data() } as CreatorProfile;
        if (
          sub.status === 'active' ||
          (sub.status === 'cancelled' && sub.endDate && (sub.endDate.toDate ? sub.endDate.toDate() : new Date(sub.endDate)) > now)
        ) {
          subscribedUsers.push(creator);
        } else {
          expiredUsers.push(creator);
        }
      }
      setUserLists([
        { name: 'Subscribed', count: subscribedUsers.length, users: subscribedUsers },
        { name: 'Expired', count: expiredUsers.length, users: expiredUsers },
      ]);
      // Default select first user if none selected
      if (selectedList === 'Subscribed' && subscribedUsers.length > 0 && !selectedUser) {
        setSelectedUser(subscribedUsers[0]);
      } else if (selectedList === 'Expired' && expiredUsers.length > 0 && !selectedUser) {
        setSelectedUser(expiredUsers[0]);
      }
    }
    fetchUserLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    async function fetchPosts() {
      if (!selectedUser || !selectedUser.uid) {
        setPosts([]);
        return;
      }
      try {
        const postsQuery = query(
          collection(db, 'posts'),
          where('authorId', '==', selectedUser.uid)
        );
        const postsSnapshot = await getDocs(postsQuery);
        const postsList: PostType[] = await Promise.all(postsSnapshot.docs.map(async docSnap => {
          const postData = docSnap.data();
          // Fetch author data
          const authorRef = doc(db, 'users', postData.authorId);
          const authorSnap = await getDoc(authorRef);
          let author = null;
          if (authorSnap.exists()) {
            const data = authorSnap.data();
            author = {
              id: authorSnap.id,
              uid: authorSnap.id,
              displayName: data.displayName || '',
              email: data.email || '',
              photoURL: data.photoURL || '/default-avatar.png',
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
              role: data.role || 'user',
              bio: data.bio || '',
              website: data.website || '',
              location: data.location || '',
              followers: Array.isArray(data.followers) ? data.followers : [],
              following: Array.isArray(data.following) ? data.following : [],
              username: data.username || '',
              isVerified: !!data.isVerified
            };
          }
          return { ...postData, id: docSnap.id, author } as any;
        }));
        setPosts(postsList);
      } catch (error) {
        console.error('Error fetching posts:', error);
        setPosts([]);
      }
    }
    fetchPosts();
  }, [selectedUser]);

  // Refetch subscriptions (for use after cancellation)
  const refetchSubscriptions = async () => {
    if (!user) return;
    try {
      const subscriptionsQuery = query(
        collection(db, 'subscriptions'),
        where('subscriberId', '==', user.uid),
        where('status', 'in', ['active', 'cancelled'])
      );
      const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
      const now = new Date();
      // Only include active or cancelled-but-not-expired subscriptions
      const validSubscriptions = subscriptionsSnapshot.docs
        .map(doc => doc.data())
        .filter(sub =>
          sub.status === 'active' ||
          (sub.status === 'cancelled' && sub.endDate &&
            (sub.endDate.toDate ? sub.endDate.toDate() : new Date(sub.endDate)) > now)
        );
      const creatorIds = validSubscriptions.map(sub => sub.creatorId);
      const creators: CreatorProfile[] = [];
      for (const creatorId of creatorIds) {
        const userRef = doc(db, 'users', creatorId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          creators.push({ uid: userSnap.id, ...userSnap.data() } as CreatorProfile);
        }
      }
      setUserLists(prevLists => {
        // Remove any existing 'Subscribed' list
        const filtered = prevLists.filter(l => l.name !== 'Subscribed');
        // Add the new 'Subscribed' list at the end
        return [
          ...filtered,
          { name: 'Subscribed', count: creators.length, users: creators }
        ];
      });
      // If the selected user is no longer in the list, clear selection
      if (selectedUser && !creators.some(c => c.uid === selectedUser.uid)) {
        setSelectedUser(creators[0] || null);
      }
    } catch (error) {
      console.error('Error refetching subscriptions:', error);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-60px)] w-full bg-gray-50">
      {/* Left Panel: User Lists */}
      <div className="w-56 border-r bg-white flex flex-col pt-6 px-4">
        <h2 className="text-lg font-bold mb-4 text-gray-800">Your Subscriptions</h2>
        <div className="flex-1 overflow-y-auto">
          {userLists.map(list => (
            <div
              key={list.name}
              className={`flex items-center justify-between px-2 py-2 cursor-pointer hover:bg-gray-100 ${selectedList === list.name ? 'bg-gray-100 font-bold' : ''}`}
              onClick={() => setSelectedList(list.name)}
            >
              <span className="text-black">{list.name}</span>
              <Badge>{list.count}</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Middle Panel: Creator Card */}
      <div className="w-96 border-r bg-gray-50 flex flex-col pt-6 px-4">
        <h2 className="text-lg font-bold mb-4 text-gray-800">Creator</h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {(() => {
            const users = userLists.find(list => list.name === selectedList)?.users || [];
            const seen = new Set();
            const uniqueUsers = users.filter(u => {
              if (!u.uid) {
                console.warn('[DEBUG] Creator missing uid:', u);
                return false;
              }
              if (seen.has(u.uid)) {
                console.warn('[DEBUG] Duplicate creator uid:', u.uid);
                return false;
              }
              seen.add(u.uid);
              return true;
            });
            return uniqueUsers.map((creator) => (
              <div
                key={creator.uid}
                className={`cursor-pointer ${selectedUser?.uid === creator.uid ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setSelectedUser(creator)}
              >
                <CreatorCard
                  userId={creator.uid}
                  username={creator.username}
                  displayName={creator.displayName}
                  photoURL={creator.photoURL}
                  coverPhotoUrl={creator.coverPhotoUrl}
                />
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Right Panel: Posts for Selected User */}
      <div className="flex-1 flex flex-col bg-gray-50 pt-6 px-4">
        <h2 className="text-lg font-bold mb-4 text-gray-800">
          {selectedUser ? `Posts by ${selectedUser.displayName || selectedUser.username}` : 'Posts'}
        </h2>
        <div className="flex-1 overflow-y-auto">
          {selectedUser ? (
            posts.length === 0 ? (
              <div className="text-gray-500 text-xs">No posts found for this account.</div>
            ) : (
              <div className="space-y-3">
                {posts.map((post, idx) => {
                  if (!post.id) {
                    console.warn('[DEBUG] Post missing id:', post);
                  }
                  return (
                    <Post key={post.id || `post-idx-${idx}`}
                      post={post as any}
                    />
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-gray-500 text-xs">Select a subscription to view their posts.</div>
          )}
        </div>
      </div>
    </div>
  );
} 