'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, getDoc, doc, getDocs, startAfter, QueryDocumentSnapshot, DocumentData, onSnapshot as onDocSnapshot, doc as docRef, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/lib/firebase/hooks/useFirestore';
import { UserProfile } from '@/lib/types/user';
import { Post as PostType, PostWithAuthor } from '@/lib/types/post';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { ContentUploadDialog } from '@/components/creator/ContentUploadDialog';
import { CompactPost } from '@/components/posts/CompactPost';
import { db } from '@/lib/firebase/config';
import { calculatePostScore, updatePostScore } from '@/lib/utils/postScore';
import { LiveStreamFeedCard } from '@/components/posts/LiveStreamFeedCard';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import LiveKitStream from '@/components/live/LiveKitStream';
import LiveChat from '@/components/live/LiveChat';
import { User } from '@/lib/types/user';
import { Timestamp } from 'firebase/firestore';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import VRVideoPlayer from '@/components/media/VRVideoPlayer';
import { Image, Video, LayoutGrid, X, ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';
import { CommentsList } from '@/components/posts/CommentsList';
import { CommentInput } from '@/components/posts/CommentInput';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'react-hot-toast';

interface ProfileContentProps {
  profile: UserProfile;
  activeTab: string;
}

interface AuthorData {
  displayName?: string;
  username?: string;
  photoURL?: string;
  role?: string;
}

export function ProfileContent({ profile, activeTab }: ProfileContentProps) {
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const PAGE_SIZE = 20;
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [liveViewerCounts, setLiveViewerCounts] = useState<Record<string, number>>({});
  const [selectedPost, setSelectedPost] = useState<PostWithAuthor | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Prevent body scroll when modal is open - More aggressive approach
  useEffect(() => {
    if (selectedPost) {
      // Store original overflow value
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      
      // Prevent scrolling
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
      
      // Cleanup function
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = '';
        const scrollY = document.body.style.top;
        document.body.style.top = '';
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
      };
    }
  }, [selectedPost]);

  const profileId = profile?.id;

  const fetchUserData = async (userId: string): Promise<AuthorData> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          displayName: userData.displayName || '',
          username: userData.username || '',
          photoURL: userData.photoURL || '',
          role: userData.role || 'user',
        };
      }
      throw new Error(`User data not found for ${userId}`);
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
    }
  };

  const fetchPosts = useCallback(async (isInitial = false) => {
    if (!profileId || (!isInitial && !hasMore)) return;

    try {
      setLoading(isInitial);
      setLoadingMore(!isInitial);

      let postsQuery = query(
        collection(db, 'posts'),
        where('authorId', '==', profileId),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );

      if (!isInitial && lastDoc) {
        postsQuery = query(
          collection(db, 'posts'),
          where('authorId', '==', profileId),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      }

      const querySnapshot = await getDocs(postsQuery);
      const newPosts: PostWithAuthor[] = [];

      for (const doc of querySnapshot.docs) {
        try {
          const postData = doc.data() as PostType;
          const authorData = await fetchUserData(postData.authorId);
          
          if (!authorData) {
            console.error(`Author data not found for post ${doc.id}`);
            continue;
          }

          const postWithAuthor: PostWithAuthor = {
            ...postData,
            id: doc.id,
            title: postData.title || postData.content || '',
            authorName: String(authorData.displayName || authorData.username || ''),
            type: (postData.type as any) || 'text',
            isPublic: postData.isPublic ?? true,
            shares: postData.shares || 0,
            taggedUsers: postData.taggedUsers || [],
            comments: postData.comments || 0,
            updatedAt: postData.updatedAt || postData.createdAt || new Date(),
            author: {
              id: postData.authorId,
              displayName: String(authorData.displayName || ''),
              photoURL: String(authorData.photoURL || ''),
              username: String(authorData.username || ''),
            }
          };

          newPosts.push(postWithAuthor);
        } catch (error) {
          console.error(`Error processing post ${doc.id}:`, error);
          continue;
        }
      }

      if (isInitial) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }

      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMore(querySnapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [profileId, hasMore, lastDoc]);

  // Set up real-time listener for posts
  useEffect(() => {
    if (!profileId) return;

    // Initial fetch
    setPosts([]);
    setLastDoc(null);
    setHasMore(true);
    fetchPosts(true);

    // Set up real-time listener for the first page
    const postsQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', profileId),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(postsQuery, async (snapshot) => {
      // Process only the first page in real-time
      const realtimePosts: PostWithAuthor[] = [];
      
      for (const doc of snapshot.docs) {
        try {
          const postData = doc.data() as PostType;
          const authorData = await fetchUserData(postData.authorId);
          
          if (!authorData) continue;

          const postWithAuthor: PostWithAuthor = {
            ...postData,
            id: doc.id,
            title: postData.title || postData.content || '',
            authorName: String(authorData.displayName || authorData.username || ''),
            type: (postData.type as any) || 'text',
            isPublic: postData.isPublic ?? true,
            shares: postData.shares || 0,
            taggedUsers: postData.taggedUsers || [],
            comments: postData.comments || 0,
            updatedAt: postData.updatedAt || postData.createdAt || new Date(),
            author: {
              id: postData.authorId,
              displayName: String(authorData.displayName || ''),
              photoURL: String(authorData.photoURL || ''),
              username: String(authorData.username || ''),
            }
          };

          realtimePosts.push(postWithAuthor);
        } catch (error) {
          console.error(`Error processing post ${doc.id}:`, error);
          continue;
        }
      }

      // Update posts state with real-time data
      setPosts(prev => {
        // Keep posts beyond the first page
        const olderPosts = prev.slice(PAGE_SIZE);
        return [...realtimePosts, ...olderPosts];
      });

      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
    });

    return () => unsubscribe();
  }, [profileId]);

  // Infinite scrolling
  useEffect(() => {
    if (loading || !hasMore) return;

    if (observer.current) {
      observer.current.disconnect();
    }

    observer.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          fetchPosts();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [loading, hasMore, lastDoc, profileId]);


  const handlePostDeleted = useCallback((deletedPostId: string) => {
    setPosts(prevPosts => prevPosts.filter(post => post.id !== deletedPostId));
  }, []);

  // Memoize the isOwnProfile check
  const isOwnProfile = useMemo(() => {
    return user?.uid && profileId && user.uid === profileId;
  }, [user?.uid, profileId]);

  useEffect(() => {
    if (!showStreamModal || !activeStreamId) return;
    // Listen to the stream document for status changes
    const unsub = onDocSnapshot(docRef(db, 'streams', activeStreamId), (docSnap) => {
      const data = docSnap.data();
      if (data && data.status === 'ended') {
        setShowStreamModal(false);
        setActiveStreamId(null);
      }
    });
    return () => unsub();
  }, [showStreamModal, activeStreamId]);

  useEffect(() => {
    // Set up real-time listeners for all live stream posts
    const unsubscribes: (() => void)[] = [];
    posts.forEach(post => {
      if (post.type === 'live_stream') {
        const unsub = onDocSnapshot(docRef(db, 'streams', post.id), (docSnap) => {
          const data = docSnap.data();
          if (data && typeof data.viewerCount === 'number') {
            setLiveViewerCounts(prev => ({ ...prev, [post.id]: data.viewerCount }));
          }
        });
        unsubscribes.push(unsub);
      }
    });
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [posts]);

  const handleEndStream = async (streamId: string) => {
    if (!streamId) return;
    try {
      await updateDoc(docRef(db, 'streams', streamId), {
        status: 'ended',
        endedAt: new Date(),
        updatedAt: new Date()
      });
      await updateDoc(docRef(db, 'posts', streamId), {
        status: 'ended',
        updatedAt: new Date()
      });
    } catch (error) {
      alert('Failed to end stream. Please try again.');
      console.error('Error ending stream:', error);
    }
  };

  // Helper: get filtered posts for the current tab
  const filteredPosts = useMemo(() => {
    console.log('🔍 Filtering posts:', { activeTab, postsCount: posts.length, posts: posts.map(p => ({ id: p.id, type: p.type, title: p.title })) });
    
    let filtered: PostWithAuthor[] = [];
    
    // Feed tab shows all posts
    if (activeTab === 'feed') {
      filtered = posts;
    } else if (activeTab === 'pictures') {
      filtered = posts.filter(post => post.type === 'image' || post.type === 'image360');
    } else if (activeTab === 'videos') {
      filtered = posts.filter(post => post.type === 'video');
    } else if (activeTab === 'videos360') {
      filtered = posts.filter(post => post.type === 'video360');
    } else if (activeTab === 'vrvideos') {
      filtered = posts.filter(post => post.type === 'vr' || post.type === 'ar');
    }
    
    console.log('✅ Filtered result:', { activeTab, filteredCount: filtered.length, filtered: filtered.map(p => ({ id: p.id, type: p.type, title: p.title })) });
    return filtered;
  }, [activeTab, posts]);

  // Check if user can view post (same logic as CompactPost)
  const canViewPost = (post: PostWithAuthor) => {
    // Always allow the creator to view their own post
    if (user && user.uid === post.authorId) return true;
    
    // Normalize access level (handle both new and legacy values)
    const accessLevel = (post as any).accessSettings?.accessLevel as 'free' | 'premium' | 'exclusive' | 'followers' | 'free_subscriber' | 'paid_subscriber' | undefined;
    
    // If no access level is set, treat as free
    if (!accessLevel) return true;
    
    // Free content is always accessible
    if (post.isPublic || accessLevel === 'free') return true;
    
    // For locked content, user needs subscription
    if (accessLevel === 'free_subscriber' || accessLevel === 'followers' || accessLevel === 'paid_subscriber' || accessLevel === 'premium' || accessLevel === 'exclusive') {
      // This is a simplified check - in a real implementation, you'd check subscription status
      // For now, we'll assume locked content requires subscription
      return false;
    }
    
    return false;
  };

  // When opening modal, set selectedIndex
  const openModal = (post: PostWithAuthor) => {
    // Don't open modal for locked content that user can't access
    if (!canViewPost(post)) {
      return;
    }
    
    const idx = filteredPosts.findIndex(p => p.id === post.id);
    setSelectedPost(post);
    setSelectedIndex(idx !== -1 ? idx : null);
  };

  // Navigation handlers
  const goToPrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedPost(filteredPosts[selectedIndex - 1]);
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const goToNext = () => {
    if (selectedIndex !== null && selectedIndex < filteredPosts.length - 1) {
      setSelectedPost(filteredPosts[selectedIndex + 1]);
      setSelectedIndex(selectedIndex + 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!selectedPost) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'Escape') setSelectedPost(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPost, selectedIndex, filteredPosts]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">

        {/* Content Display - same structure as home page */}
        <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {activeTab === 'feed' ? 'No posts found' : `No ${activeTab} found`}
              </p>
            </div>
          ) : activeTab === 'feed' ? (
            // Feed tab: Show full posts like home page
            <div className="space-y-3">
              {filteredPosts.map((post) => (
                <div key={post.id}>
                  {post.type === 'live_stream' ? (
                    <LiveStreamFeedCard
                      streamId={post.id}
                      title={post.title}
                      description={post.content}
                      author={post.author}
                      createdAt={post.createdAt}
                      thumbnailUrl={post.thumbnailUrl}
                      onEndStream={() => handleEndStream(post.id)}
                      onClick={() => openModal(post)}
                    />
                  ) : (
                    <CompactPost
                      post={post}
                      currentUserId={profile.id}
                      onPostDeleted={handlePostDeleted}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Other tabs: Show media content in grid with access control
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPosts.map((post) => (
                <div 
                  key={post.id} 
                  className={`relative aspect-square ${canViewPost(post) ? 'cursor-pointer' : 'cursor-default'}`} 
                  onClick={() => canViewPost(post) && openModal(post)}
                >
                  {/* Use CompactPost for access control but display only the media area */}
                  <div className="w-full h-full">
                    <CompactPost
                      post={post}
                      currentUserId={profile.id}
                      onPostDeleted={handlePostDeleted}
                      showAsGridItem={true}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load more trigger */}
          {hasMore && (
            <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  Loading more...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Facebook-Style Post Display */}
        {selectedPost && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-8"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedPost(null);
              }
            }}
          >
            {/* Just the Post Component - Fixed size container */}
            <div className="relative max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-300">
              {/* Fixed size container for consistent post dimensions */}
              <div className="w-full max-w-2xl mx-auto">
                <CompactPost
                  post={selectedPost}
                  currentUserId={profile.id}
                  onPostDeleted={handlePostDeleted}
                  transparent={false}
                  showNavigation={true}
                  onClose={() => setSelectedPost(null)}
                  onPrev={goToPrev}
                  onNext={goToNext}
                  canGoPrev={selectedIndex !== 0}
                  canGoNext={selectedIndex !== filteredPosts.length - 1}
                  currentIndex={selectedIndex || 0}
                  totalCount={filteredPosts.length}
                />
              </div>
            </div>
          </div>
        )}
    </div>
  );
}