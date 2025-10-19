'use client';

import React, { useEffect, useState } from 'react';
import { CreatorCard } from '@/components/user/CreatorCard';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { UserSubscription } from '../../types/subscription';
import { CreatorProfile } from '@/types/user';
import { CompactPost } from '@/components/posts/CompactPost';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Handle deleting expired creator from list
  const handleDeleteExpiredCreator = (creatorUid: string) => {
    // Remove from the Expired list
    setUserLists(prevLists => {
      return prevLists.map(list => {
        if (list.name === 'Expired') {
          const updatedUsers = list.users.filter(u => u.uid !== creatorUid);
          return {
            ...list,
            users: updatedUsers,
            count: updatedUsers.length
          };
        }
        return list;
      });
    });

    // If the deleted creator was selected, clear selection
    if (selectedUser?.uid === creatorUid) {
      setSelectedUser(null);
      setPosts([]);
    }
    
    // Close confirmation dropdown
    setShowDeleteConfirm(null);
  };

  // Backend logic - keep all existing useEffect hooks and functions
  useEffect(() => {
    async function fetchUserLists() {
      if (!user) return;
      
      // Fetch subscriptions
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
      
      // Check if user has active subscription (is in Subscribed list)
      const hasActiveSubscription = selectedList === 'Subscribed';
      
      // Real data fetching
      try {
        const postsQuery = query(
          collection(db, 'posts'),
          where('authorId', '==', selectedUser.uid)
        );
        const postsSnapshot = await getDocs(postsQuery);
        const postsList: PostType[] = await Promise.all(postsSnapshot.docs.map(async docSnap => {
          const postData = docSnap.data();
          // Fetch author data
          const authorId = postData.authorId || postData.userId;
          if (!authorId) {
            console.error(`No author ID found for post ${docSnap.id}`);
            return null;
          }
          const authorRef = doc(db, 'users', authorId);
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
        setPosts(postsList.filter(post => post !== null));
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
    <div className="flex flex-col bg-white rounded-lg shadow-sm overflow-hidden" style={{height: '74vh', marginTop: '-30px', position: 'relative', zIndex: 20}}>
      {/* Top Header - Radio Buttons spanning both columns */}
      <div className="px-4 py-1.5 border-b border-gray-200 flex items-center justify-center" style={{minHeight: '48px'}}>
        <div className="tab-container">
          {userLists.map((list, index) => (
            <React.Fragment key={list.name}>
              <input 
                type="radio" 
                name="subscriptionStatus" 
                id={`tab-${index + 1}`}
                className={`tab tab--${index + 1}`}
                checked={selectedList === list.name}
                onChange={() => setSelectedList(list.name)}
              />
              <label className="tab_label" htmlFor={`tab-${index + 1}`}>
                {list.name}
              </label>
            </React.Fragment>
          ))}
          <div className="indicator"></div>
        </div>
      </div>

          {/* Two Columns with their titles */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left Column - Creator List */}
            <div className="w-80 flex flex-col bg-white border-r border-gray-200">
              {/* Column Title */}
              <div className="px-4 py-2 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-base font-bold text-gray-800">Creators</h2>
              </div>
              
              {/* Creators List */}
              <div className="flex-1 overflow-y-auto space-y-2 pt-6 px-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e0 #f7fafc' }}>
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
                className={`relative cursor-pointer transition-opacity duration-200 group ${selectedUser?.uid === creator.uid ? 'opacity-100' : 'opacity-70 hover:opacity-85'}`}
                onClick={() => setSelectedUser(creator)}
              >
                <CreatorCard
                  userId={creator.uid}
                  username={creator.username}
                  displayName={creator.displayName}
                  photoURL={creator.photoURL}
                  coverPhotoUrl={creator.coverPhotoUrl}
                />
                {selectedList === 'Expired' && (
                  <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(showDeleteConfirm === creator.uid ? null : creator.uid);
                      }}
                      className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-colors"
                      title="Remove from list"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    {showDeleteConfirm === creator.uid && (
                      <div 
                        className="absolute top-12 right-0 w-32 bg-white border-0 overflow-hidden p-0 shadow-lg"
                        style={{
                          borderRadius: '12px',
                          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteExpiredCreator(creator.uid);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 transition-all duration-200 border-b border-gray-100"
                        >
                          Yes, Remove
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(null);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 transition-all duration-200"
                        >
                          No, Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ));
          })()}
        </div>
        </div>

            {/* Right Column - Posts */}
            <div className="flex-1 flex flex-col bg-white">
              {/* Column Title */}
              <div className="px-4 py-2 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-base font-bold text-gray-800">Posts</h2>
              </div>

              {/* Posts Content */}
              <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e0 #f7fafc' }}>
          {selectedUser ? (
            posts.length === 0 ? (
              <div className="text-gray-500 text-sm">No posts found for this account.</div>
            ) : (
              <div className="space-y-3">
                {posts.map((post, idx) => {
                  if (!post.id) {
                    console.warn('[DEBUG] Post missing id:', post);
                  }
                  return (
                    <CompactPost 
                      key={post.id || `post-idx-${idx}`}
                      post={post as any}
                      currentUserId={user?.uid}
                      onPostDeleted={(postId) => {
                        setPosts(prev => prev.filter(p => p.id !== postId));
                      }}
                    />
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-gray-500 text-sm">Select a subscription to view their posts.</div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}