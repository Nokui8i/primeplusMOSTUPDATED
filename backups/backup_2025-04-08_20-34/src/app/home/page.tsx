'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, orderBy, limit, getDocs, startAfter, onSnapshot, getDoc, doc as firestoreDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db } from '@/lib/firebase/config'
import { useAuth } from '@/lib/firebase/auth'
import { FiLoader } from 'react-icons/fi'
import { Post } from '@/components/Post'
import { Search } from '@/components/Search'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'

interface UserData {
  displayName: string
  photoURL: string
  nickname: string
}

interface PostData {
  authorId: string
  content: string
  imageUrl?: string
  likes: number
  comments: number
  createdAt: any
}

interface Post extends PostData {
  id: string
  author: UserData
}

const POSTS_PER_PAGE = 10

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const lastPostRef = useRef<any>(null)
  const router = useRouter()
  const { auth } = useAuth()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/')
      }
    })

    return () => unsubscribe()
  }, [router])

  // Real-time updates for new posts
  useEffect(() => {
    const postsQuery = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(POSTS_PER_PAGE)
    )

    const unsubscribe = onSnapshot(postsQuery, async (snapshot) => {
      const newPosts = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const postData = doc.data() as PostData
          const authorDoc = await getDoc(firestoreDoc(db, 'users', postData.authorId))
          const authorData = authorDoc.data() as UserData

          return {
            id: doc.id,
            ...postData,
            author: authorData
          }
        })
      )

      setPosts(newPosts)
      lastPostRef.current = snapshot.docs[snapshot.docs.length - 1]
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const loadMorePosts = async () => {
    if (!hasMore || loadingMore || !lastPostRef.current) return

    setLoadingMore(true)

    try {
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        startAfter(lastPostRef.current),
        limit(POSTS_PER_PAGE)
      )

      const snapshot = await getDocs(postsQuery)
      
      if (snapshot.empty) {
        setHasMore(false)
        return
      }

      const morePosts = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const postData = doc.data() as PostData
          const authorDoc = await getDoc(firestoreDoc(db, 'users', postData.authorId))
          const authorData = authorDoc.data() as UserData

          return {
            id: doc.id,
            ...postData,
            author: authorData
          }
        })
      )

      setPosts(prev => [...prev, ...morePosts])
      lastPostRef.current = snapshot.docs[snapshot.docs.length - 1]
    } catch (error) {
      console.error('Error loading more posts:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  const { loadMoreRef } = useInfiniteScroll({
    data: posts,
    hasMore,
    isLoading: loadingMore,
    onLoadMore: loadMorePosts,
  })

  const handleSearch = (query: string) => {
    console.log('Search:', query)
    // Implement search functionality
  }

  const handleLike = (postId: string) => {
    console.log('Like post:', postId)
    // Implement like functionality
  }

  const handleComment = (postId: string) => {
    console.log('Comment on post:', postId)
    // Implement comment functionality
  }

  const handleShare = (postId: string) => {
    console.log('Share post:', postId)
    // Implement share functionality
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <Search onSearch={handleSearch} />
      
      {/* Posts Feed */}
      <div className="space-y-4 mt-6">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <FiLoader className="w-8 h-8 animate-spin text-pink-600" />
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <Post 
                key={post.id}
                id={post.id}
                author={post.author}
                content={post.content}
                imageUrl={post.imageUrl}
                likes={post.likes}
                comments={post.comments}
                createdAt={post.createdAt}
                onLike={() => handleLike(post.id)}
                onComment={() => handleComment(post.id)}
                onShare={() => handleShare(post.id)}
              />
            ))}
            
            {/* Load More Trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="py-4 flex justify-center">
                {loadingMore && (
                  <FiLoader className="w-6 h-6 animate-spin text-pink-600" />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}