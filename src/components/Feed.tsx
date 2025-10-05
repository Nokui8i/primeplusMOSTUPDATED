import { useState, useEffect, useCallback, useRef } from 'react'
import { collection, query, orderBy, limit, startAfter, getDocs, where } from 'firebase/firestore'
import { db } from '../lib/firebase/config'
import { Post } from './Post'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { useAuth } from '../hooks/useAuth'
import { PostData } from '../types'
import { ErrorBoundary } from './ErrorBoundary'

const POSTS_PER_PAGE = 10
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface CachedData {
  posts: PostData[]
  timestamp: number
}

export function Feed() {
  const [posts, setPosts] = useState<PostData[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const { user } = useAuth()
  const cache = useRef<Map<string, CachedData>>(new Map())

  const fetchPosts = useCallback(async (isInitial = false) => {
    if (isLoading) return

    try {
      setIsLoading(true)
      setError(null)

      const cacheKey = isInitial ? 'initial' : lastDoc?.id
      const cached = cache.current.get(cacheKey)
      const now = Date.now()

      if (cached && now - cached.timestamp < CACHE_DURATION) {
        setPosts(prev => isInitial ? cached.posts : [...prev, ...cached.posts])
        setHasMore(cached.posts.length === POSTS_PER_PAGE)
        return
      }

      let q = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(POSTS_PER_PAGE)
      )

      if (!isInitial && lastDoc) {
        q = query(q, startAfter(lastDoc))
      }

      const snapshot = await getDocs(q)
      const newPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PostData[]

      if (newPosts.length > 0) {
        cache.current.set(cacheKey, {
          posts: newPosts,
          timestamp: now
        })
      }

      setPosts(prev => isInitial ? newPosts : [...prev, ...newPosts])
      setHasMore(newPosts.length === POSTS_PER_PAGE)
      setLastDoc(snapshot.docs[snapshot.docs.length - 1])
    } catch (err) {
      console.error('Error fetching posts:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch posts'))
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, lastDoc])

  useEffect(() => {
    fetchPosts(true)
  }, [fetchPosts])

  const handleLoadMore = useCallback(() => fetchPosts(false), [fetchPosts])

  const { loadMoreRef, loadMore } = useInfiniteScroll({
    data: posts,
    hasMore,
    isLoading,
    onLoadMore: handleLoadMore,
    error
  })

  const handlePostUpdate = useCallback((updatedPost: PostData) => {
    setPosts(prev => prev.map(post => 
      post.id === updatedPost.id ? updatedPost : post
    ))
  }, [])

  const handlePostDelete = useCallback((postId: string) => {
    setPosts(prev => prev.filter(post => post.id !== postId))
  }, [])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <p className="text-red-500 mb-4">{error.message}</p>
        <button
          onClick={() => fetchPosts(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="max-w-2xl mx-auto p-4">
        {posts.map((post, index) => (
          <Post
            key={post.id}
            post={post}
            onUpdate={handlePostUpdate}
            onDelete={handlePostDelete}
            ref={index === posts.length - 1 ? loadMoreRef : undefined}
          />
        ))}
        {isLoading && (
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
} 