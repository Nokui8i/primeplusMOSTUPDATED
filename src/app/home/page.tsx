'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, orderBy, limit, getDocs, startAfter, getDoc, doc as docRef, Timestamp, DocumentData, onSnapshot, increment, updateDoc, where } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '@/lib/firebase/config'
import { useAuth } from '@/lib/firebase/auth'
import { CompactPost } from '@/components/posts/CompactPost'
import { useInView } from 'react-intersection-observer'
import { Post, PostWithAuthor, PostType } from '@/lib/types/post'
import { User } from '@/lib/types/user'
import { LiveStreamFeedCard } from '@/components/posts/LiveStreamFeedCard'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import LiveKitStream from '@/components/live/LiveKitStream'
import LiveChat from '@/components/live/LiveChat'
import { onSnapshot as onDocSnapshot } from 'firebase/firestore'

const POSTS_PER_PAGE = 10

export default function HomePage() {
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const router = useRouter()
  const { user } = useAuth()
  const { ref: loadMoreRef, inView } = useInView()
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null)
  const [showStreamModal, setShowStreamModal] = useState(false)
  const [streamInfo, setStreamInfo] = useState<{ viewerCount: number; title: string }>({ viewerCount: 0, title: '' })
  const incrementedRef = useRef(false)
  const [liveViewerCounts, setLiveViewerCounts] = useState<Record<string, number>>({});

  const getDateSafe = (value: any) => {
    if (!value) return new Date();
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') return new Date(value);
    return new Date();
  };

  const processPost = async (doc: any): Promise<PostWithAuthor> => {
    const postData = doc.data();
    const authorSnap = await getDoc(docRef(db, 'users', postData.authorId));
    const authorData = authorSnap.data() as DocumentData;

    if (!authorData) {
      throw new Error(`Author data not found for post ${doc.id}`);
    }

    const author: User = {
      id: authorSnap.id,
      uid: authorSnap.id,
      displayName: String(authorData.displayName || 'Anonymous'),
      email: String(authorData.email || ''),
      photoURL: String(authorData.photoURL || '/default-avatar.png'),
      createdAt: getDateSafe(authorData.createdAt),
      updatedAt: getDateSafe(authorData.updatedAt),
      role: authorData.role || 'user',
      bio: String(authorData.bio || ''),
      website: String(authorData.website || ''),
      location: String(authorData.location || ''),
      followers: Array.isArray(authorData.followers) ? authorData.followers : [],
      following: Array.isArray(authorData.following) ? authorData.following : [],
      username: String(authorData.username || ''),
      isVerified: Boolean(authorData.isVerified)
    };

    const post: PostWithAuthor = {
      id: doc.id,
      title: postData.title || '',
      content: postData.content || '',
      authorName: author.displayName,
      mediaUrl: postData.imageUrl || postData.mediaUrl,
      thumbnailUrl: postData.thumbnailUrl,
      likes: postData.likes || 0,
      comments: postData.comments || 0,
      shares: postData.shares || 0,
      authorId: postData.authorId,
      type: (postData.type || 'text') as PostType,
      status: postData.status || 'active',
      isPublic: postData.isPublic ?? true,
      createdAt: postData.createdAt || Timestamp.now(),
      updatedAt: postData.updatedAt || Timestamp.now(),
      tags: postData.tags || [],
      taggedUsers: postData.taggedUsers || [],
      metadata: {
        width: postData.metadata?.width,
        height: postData.metadata?.height,
        duration: postData.metadata?.duration,
        fileSize: postData.metadata?.fileSize,
        mimeType: postData.metadata?.mimeType
      },
      engagement: {
        views: postData.engagement?.views || 0,
        uniqueViews: postData.engagement?.uniqueViews || 0,
        averageViewDuration: postData.engagement?.averageViewDuration,
        clickThroughRate: postData.engagement?.clickThroughRate,
        saveCount: postData.engagement?.saveCount || 0,
        reportCount: postData.engagement?.reportCount || 0,
        relevanceScore: postData.engagement?.relevanceScore
      },
      author,
      accessSettings: postData.accessSettings || {}
    };

    return post;
  };

  // Set up real-time listener for posts
  useEffect(() => {
    if (!user) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'), limit(POSTS_PER_PAGE));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const newPosts: PostWithAuthor[] = [];
      for (const doc of snapshot.docs) {
        const postData = doc.data();
        const authorSnap = await getDoc(docRef(db, 'users', postData.authorId));
        const authorData = authorSnap.data() as DocumentData;
        if (!authorData) {
          console.error(`Author data not found for post ${doc.id}`);
          continue;
        }
        newPosts.push({
          id: doc.id,
          title: postData.title || '',
          content: postData.content || '',
          authorName: authorData.displayName || 'Anonymous',
          mediaUrl: postData.mediaUrl,
          mediaType: postData.mediaType,
          thumbnailUrl: postData.thumbnailUrl,
          background: postData.background,
          authorId: postData.authorId || postData.userId,
          type: postData.type || 'text',
          isPublic: postData.isPublic ?? true,
          createdAt: postData.createdAt || Timestamp.now().toDate(),
          updatedAt: postData.updatedAt || Timestamp.now().toDate(),
          likes: postData.likes || 0,
          comments: postData.comments || 0,
          shares: postData.shares || 0,
          tags: postData.tags || [],
          location: postData.location,
          taggedUsers: postData.taggedUsers || [],
          commands: postData.commands,
          likedBy: postData.likedBy,
          metadata: {
            width: postData.metadata?.width,
            height: postData.metadata?.height,
            duration: postData.metadata?.duration,
            fileSize: postData.metadata?.fileSize,
            mimeType: postData.metadata?.mimeType,
            aspectRatio: postData.metadata?.aspectRatio,
            quality: postData.metadata?.quality,
            format: postData.metadata?.format,
            imageMetadata: postData.metadata?.imageMetadata,
            videoMetadata: postData.metadata?.videoMetadata,
            audioMetadata: postData.metadata?.audioMetadata,
            vrMetadata: postData.metadata?.vrMetadata
          },
          engagement: {
            views: postData.engagement?.views || 0,
            uniqueViews: postData.engagement?.uniqueViews || 0,
            averageViewDuration: postData.engagement?.averageViewDuration,
            clickThroughRate: postData.engagement?.clickThroughRate,
            saveCount: postData.engagement?.saveCount || 0,
            reportCount: postData.engagement?.reportCount || 0,
            relevanceScore: postData.engagement?.relevanceScore
          },
          moderation: postData.moderation,
          organization: postData.organization,
          vrSettings: postData.vrSettings,
          storySettings: postData.storySettings,
          accessSettings: postData.accessSettings,
          analytics: postData.analytics,
          streamId: postData.streamId,
          viewerCount: postData.viewerCount,
          status: postData.status,
          showWatermark: postData.showWatermark,
          author: {
            id: authorSnap.id,
            displayName: String(authorData.displayName || 'Anonymous'),
            photoURL: String(authorData.photoURL || '/default-avatar.png'),
            username: String(authorData.username || '')
          }
        });
      }
      setPosts(newPosts);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching posts:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handlePostDeleted = (postId: string) => {
    setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/')
      }
    })
    return () => unsubscribe()
  }, [router])

  const handleUploadComplete = useCallback(() => {
    // Reset the posts list and load latest posts
    setPosts([]);
    setLastDoc(null);
    setHasMore(true);
    // Load the first page of posts on mount
    if (posts.length === 0 && !loading) {
      // Load the first page of posts on mount
      const postsRef = collection(db, 'posts');
      const q = query(postsRef, orderBy('createdAt', 'desc'), limit(POSTS_PER_PAGE));
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const newPosts: PostWithAuthor[] = [];
        for (const doc of snapshot.docs) {
          const postData = doc.data();
          const authorSnap = await getDoc(docRef(db, 'users', postData.authorId));
          const authorData = authorSnap.data() as DocumentData;
          if (!authorData) {
            console.error(`Author data not found for post ${doc.id}`);
            continue;
          }
          newPosts.push({
            id: doc.id,
            title: postData.title || '',
            content: postData.content || '',
            authorName: authorData.displayName || 'Anonymous',
            mediaUrl: postData.mediaUrl,
            mediaType: postData.mediaType,
            thumbnailUrl: postData.thumbnailUrl,
            background: postData.background,
            authorId: postData.authorId || postData.userId,
            type: postData.type || 'text',
            isPublic: postData.isPublic ?? true,
            createdAt: postData.createdAt || Timestamp.now().toDate(),
            updatedAt: postData.updatedAt || Timestamp.now().toDate(),
            likes: postData.likes || 0,
            comments: postData.comments || 0,
            shares: postData.shares || 0,
            tags: postData.tags || [],
            location: postData.location,
            taggedUsers: postData.taggedUsers || [],
            commands: postData.commands,
            likedBy: postData.likedBy,
            metadata: {
              width: postData.metadata?.width,
              height: postData.metadata?.height,
              duration: postData.metadata?.duration,
              fileSize: postData.metadata?.fileSize,
              mimeType: postData.metadata?.mimeType,
              aspectRatio: postData.metadata?.aspectRatio,
              quality: postData.metadata?.quality,
              format: postData.metadata?.format,
              imageMetadata: postData.metadata?.imageMetadata,
              videoMetadata: postData.metadata?.videoMetadata,
              audioMetadata: postData.metadata?.audioMetadata,
              vrMetadata: postData.metadata?.vrMetadata
            },
            engagement: {
              views: postData.engagement?.views || 0,
              uniqueViews: postData.engagement?.uniqueViews || 0,
              averageViewDuration: postData.engagement?.averageViewDuration,
              clickThroughRate: postData.engagement?.clickThroughRate,
              saveCount: postData.engagement?.saveCount || 0,
              reportCount: postData.engagement?.reportCount || 0,
              relevanceScore: postData.engagement?.relevanceScore
            },
            moderation: postData.moderation,
            organization: postData.organization,
            vrSettings: postData.vrSettings,
            storySettings: postData.storySettings,
            accessSettings: postData.accessSettings,
            analytics: postData.analytics,
            streamId: postData.streamId,
            viewerCount: postData.viewerCount,
            status: postData.status,
            showWatermark: postData.showWatermark,
            author: {
              id: authorSnap.id,
              displayName: String(authorData.displayName || 'Anonymous'),
              photoURL: String(authorData.photoURL || '/default-avatar.png'),
              username: String(authorData.username || '')
            }
          });
        }
        setPosts(newPosts);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === POSTS_PER_PAGE);
      });
    }
  }, [loading]);

  // Clear sessionStorage when the page is unloaded (refresh or close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('hasLoaded')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  useEffect(() => {
    if (!showStreamModal || !activeStreamId) return;
    let unsub: (() => void) | undefined;
    let isHost = false;
    // Listen to the stream document for status changes and viewer count
    unsub = onDocSnapshot(docRef(db, 'streams', activeStreamId), (docSnap) => {
      const data = docSnap.data();
      if (data) {
        setStreamInfo({
          viewerCount: data.viewerCount || 0,
          title: data.title || 'Live Stream',
        });
        if (data.status === 'ended') {
          setShowStreamModal(false);
          setActiveStreamId(null);
        }
        if (user?.uid === data.userId) {
          isHost = true;
        }
      }
    });
    // Increment viewer count ONCE when modal opens, if not host
    (async () => {
      if (!incrementedRef.current && user && activeStreamId) {
        const streamDoc = await getDoc(docRef(db, 'streams', activeStreamId));
        if (streamDoc.exists() && streamDoc.data().userId !== user.uid) {
          await updateDoc(docRef(db, 'streams', activeStreamId), { viewerCount: increment(1) });
          incrementedRef.current = true;
        }
      }
    })();
    // Decrement viewer count ONCE when modal closes
    return () => {
      if (incrementedRef.current && activeStreamId) {
        updateDoc(docRef(db, 'streams', activeStreamId), { viewerCount: increment(-1) }).catch(() => {});
        incrementedRef.current = false;
      }
      if (unsub) unsub();
    };
  }, [showStreamModal, activeStreamId, user?.uid]);

  useEffect(() => {
    // Set up real-time listeners for all live stream posts
    const unsubscribes: (() => void)[] = [];
    posts.forEach(post => {
      if (post.type === 'live_stream' && post.status === 'live') {
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

  if (loading && posts.length === 0) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="space-y-6">
          {posts
            .filter(post => post.type !== 'live_stream' || (post.type === 'live_stream' && post.status === 'live'))
            .map((post) => (
              <div key={post.id}>
                {post.type === 'live_stream' ? (
                  <LiveStreamFeedCard
                    streamId={post.id}
                    title={post.title || ''}
                    description={post.content}
                    author={{
                      id: post.authorId,
                      displayName: post.author.displayName,
                      photoURL: post.author.photoURL,
                      username: post.author.username
                    }}
                    createdAt={getDateSafe(post.createdAt)}
                    thumbnailUrl={post.thumbnailUrl}
                    onClick={() => {
                      setActiveStreamId(post.id);
                      setShowStreamModal(true);
                    }}
                    onEndStream={user?.uid === post.authorId ? () => handleEndStream(post.id) : undefined}
                  />
                ) : (
                  <CompactPost 
                    post={post}
                    currentUserId={user?.uid}
                    onPostDeleted={handlePostDeleted}
                  />
                )}
              </div>
            ))}
          {loading && posts.length > 0 && (
            <div className="text-center text-gray-500">
              Loading more posts...
            </div>
          )}
          {!loading && posts.length === 0 && (
            <div className="text-center text-gray-500">
              No posts found. Be the first to create one!
            </div>
          )}
          <div ref={loadMoreRef} className="h-4" />
        </div>
      </div>


      {/* Stream Modal */}
      <Dialog open={showStreamModal} onOpenChange={setShowStreamModal}>
        <DialogContent className="max-w-3xl w-full rounded-xl bg-[#18181b] shadow-2xl border-0 p-0 overflow-hidden">
          {activeStreamId && (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#232326]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-full text-xs font-bold shadow animate-pulse">
                    <span className="w-2 h-2 bg-white rounded-full animate-ping mr-1" /> LIVE
                  </span>
                  <span className="text-xs text-zinc-200 bg-zinc-700 rounded px-2 py-0.5 flex items-center gap-1">
                    <svg className="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14.5A6.5 6.5 0 1110 3.5a6.5 6.5 0 010 13z" /></svg> {streamInfo.viewerCount}
                  </span>
                  <span className="text-base font-semibold text-white ml-4 truncate">{streamInfo.title}</span>
                </div>
                <button
                  onClick={() => { setShowStreamModal(false); setActiveStreamId(null); }}
                  className="text-zinc-400 hover:text-red-500 bg-zinc-800 hover:bg-zinc-700 rounded-full p-2 shadow"
                  aria-label="Leave Stream"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {/* Content */}
              <div className="flex flex-col md:flex-row gap-0 md:gap-6 p-0 md:p-6 bg-[#18181b] md:h-[520px]">
                {/* Stream Player + Action Bar */}
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg bg-black">
                    <LiveKitStream roomName={activeStreamId} isHost={false} />
                  </div>
                  {/* Action Bar */}
                  <div className="flex items-center justify-between w-full px-2 py-3 bg-[#232326] rounded-b-xl mt-0">
                    <div className="flex gap-4 items-center">
                      <button className="text-zinc-400 hover:text-red-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-6 0v4" /><path d="M5 12h14" /><path d="M12 17v-5" /></svg></button>
                      <button className="text-zinc-400 hover:text-blue-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" /></svg></button>
                      <button className="text-zinc-400 hover:text-yellow-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg></button>
                    </div>
                    <button className="text-zinc-400 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg></button>
                  </div>
                </div>
                {/* Live Chat */}
                <div className="w-full md:w-80 flex flex-col mt-4 md:mt-0">
                  <div className="rounded-xl overflow-hidden shadow bg-[#232326] flex-1 max-h-72 md:max-h-full flex flex-col">
                    <LiveChat streamId={activeStreamId} />
                  </div>
                </div>
              </div>
              {/* Leave Button */}
              <div className="flex justify-center px-6 pb-6 bg-[#18181b]">
                <button
                  onClick={() => { setShowStreamModal(false); setActiveStreamId(null); }}
                  className="w-auto px-6 py-2 text-sm bg-gradient-to-br from-[#3a3a7a] via-[#7c5fe6] to-[#c299fc] text-white font-medium rounded-full shadow-lg hover:opacity-90 transition-all duration-200"
                >
                  Leave Stream
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}