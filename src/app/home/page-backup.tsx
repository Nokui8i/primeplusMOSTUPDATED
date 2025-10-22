'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter, 
  getDoc, 
  doc as docRef, 
  Timestamp, 
  DocumentData, 
  onSnapshot, 
  increment, 
  updateDoc, 
  where 
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '@/lib/firebase/config'
import { useAuth } from '@/lib/firebase/auth'
import CompactPost from '@/components/posts/CompactPost'
import AppLoader from '@/components/common/AppLoader'
import { isUserBlocked } from '@/lib/services/block.service'

const POSTS_PER_PAGE = 10

export default function HomePage() {
  console.log('🏠 HomePage component rendering...')
  
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState(null)
  const router = useRouter()
  const { user } = useAuth()
  
  console.log('🏠 HomePage state:', { 
    posts: posts.length, 
    loading, 
    hasMore, 
    user: user?.uid,
    userExists: !!user
  })

  if (loading && posts.length === 0) {
    console.log('🏠 HomePage: Showing AppLoader')
    return <AppLoader isVisible={true} />;
  }

  console.log('🏠 HomePage: Rendering posts:', posts.length)
  
  return (
    <div className="w-full">
      <div className="w-full">
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id}>
              <CompactPost 
                post={post}
                currentUserId={user?.uid}
                onPostDeleted={() => {}}
              />
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
        </div>
      </div>
    </div>
  )
}
