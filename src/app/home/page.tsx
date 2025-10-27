'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, orderBy, limit, getDocs, startAfter, getDoc, doc as docRef, Timestamp, DocumentData, onSnapshot, increment, updateDoc, where } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '@/lib/firebase/config'
import { useAuth } from '@/lib/firebase/auth'
import { CompactPost } from '@/components/posts/CompactPost'
import { useInView } from 'react-intersection-observer'
import { Post, PostWithAuthor, PostType } from '@/lib/types/post'
import { User } from '@/lib/types/user'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { onSnapshot as onDocSnapshot } from 'firebase/firestore'
import AppLoader from '@/components/common/AppLoader'
import { isUserBlocked } from '@/lib/services/block.service'
import { useFilter } from '@/contexts/FilterContext'

const POSTS_PER_PAGE = 10

export default function HomePage() {
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const router = useRouter()
  const { user } = useAuth()
  const { hideLockedPosts } = useFilter()
  const { ref: loadMoreRef, inView } = useInView()
  const incrementedRef = useRef(false)

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
      views: postData.views || 0,
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
      try {
        const docs = snapshot.docs;
        
        // Batch fetch all author IDs
        const authorIds = [...new Set(docs.map(doc => {
          const data = doc.data();
          return data.authorId || data.userId;
        }).filter(Boolean))] as string[];

        // Batch fetch all user documents in parallel
        const userDocs = await Promise.all(
          authorIds.map(id => getDoc(docRef(db, 'users', id)))
        );
        
        // Create a map for quick lookup
        const userMap = new Map();
        userDocs.forEach((userDoc, index) => {
          if (userDoc.exists()) {
            userMap.set(authorIds[index], userDoc.data());
          }
        });

        // Batch fetch block status
        const currentUserDoc = await getDoc(docRef(db, 'users', user.uid));
        const currentUserData = currentUserDoc.data();
        const blockedUsers = new Set(currentUserData?.blockedUsers || []);

        // Build posts with batched data
        const newPosts: PostWithAuthor[] = [];
        for (const doc of docs) {
          const postData = doc.data();
          const authorId = postData.authorId || postData.userId;
          if (!authorId) continue;

          // Check block status from Set
          if (blockedUsers.has(authorId)) continue;

          const authorData = userMap.get(authorId);
          if (!authorData) continue;
          
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
          views: postData.views || 0,
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
          status: postData.status,
          showWatermark: postData.showWatermark,
          author: {
            id: authorId,
            displayName: String(authorData.displayName || 'Anonymous'),
            photoURL: String(authorData.photoURL || '/default-avatar.png'),
            username: String(authorData.username || '')
          }
        });
      }
      setPosts(newPosts);
      setLoading(false);
      } catch (error) {
        console.error('Error fetching posts:', error);
        setLoading(false);
      }
    }, (error) => {
      console.error('Error in snapshot:', error);
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
            views: postData.views || 0,
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



  // Infinite scroll effect
  useEffect(() => {
    if (inView && hasMore && !loading) {
      console.log('🔄 Loading more posts...');
      const loadMorePosts = async () => {
        if (!lastDoc) return;
        
        try {
          setLoading(true);
          const postsRef = collection(db, 'posts');
          const q = query(
            postsRef, 
            orderBy('createdAt', 'desc'), 
            startAfter(lastDoc), 
            limit(POSTS_PER_PAGE)
          );
          
          const snapshot = await getDocs(q);
          const newPosts: PostWithAuthor[] = [];
          
          for (const doc of snapshot.docs) {
            try {
              const processedPost = await processPost(doc);
              newPosts.push(processedPost);
            } catch (error) {
              console.error('Error processing post:', error);
            }
          }
          
          if (newPosts.length > 0) {
            setPosts(prev => [...prev, ...newPosts]);
            setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === POSTS_PER_PAGE);
          } else {
            setHasMore(false);
          }
        } catch (error) {
          console.error('Error loading more posts:', error);
        } finally {
          setLoading(false);
        }
      };
      
      loadMorePosts();
    }
  }, [inView, hasMore, loading, lastDoc]);


  // Filter posts based on hideLockedPosts setting
  const filteredPosts = useMemo(() => {
    if (!hideLockedPosts) return posts;
    
    return posts.filter(post => {
      // Keep posts that are free (no access settings or free access)
      const accessLevel = post.accessSettings?.accessLevel;
      return !accessLevel || accessLevel === 'free';
    });
  }, [posts, hideLockedPosts]);

  if (loading && posts.length === 0) {
    return <AppLoader isVisible={true} />;
  }

  return (
    <div className="space-y-6">
      {filteredPosts.map((post) => (
        <div key={post.id}>
          <CompactPost 
            post={post}
            currentUserId={user?.uid}
            onPostDeleted={handlePostDeleted}
          />
        </div>
      ))}
      {loading && posts.length > 0 && (
        <div className="text-center text-gray-500 py-8">
          Loading more posts...
        </div>
      )}
      {!loading && posts.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          <div className="text-lg font-medium mb-2">No posts found</div>
          <div className="text-sm">Be the first to create one!</div>
        </div>
      )}
      <div ref={loadMoreRef} className="h-4" />
    </div>
  )
}