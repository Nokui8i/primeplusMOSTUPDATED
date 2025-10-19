import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { toggleLike } from '@/lib/firebase/db'
import { toast } from 'react-hot-toast'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { LikesList } from '../posts/LikesList'

interface LikeButtonProps {
  postId: string
  initialLikes?: number
  initialIsLiked?: boolean
  className?: string
}

export function CommandLikeButton({ postId, initialLikes = 0, initialIsLiked = false, className = '' }: LikeButtonProps) {
  const { user } = useAuth()
  const [isLiked, setIsLiked] = useState(initialIsLiked)
  const [likes, setLikes] = useState(initialLikes)
  const [showLikes, setShowLikes] = useState(false)

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      toast.error('Please sign in to like posts')
      return
    }

    try {
      // Get user's display name from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      const userData = userDoc.data()
      const displayName = userData?.displayName || 'Anonymous'

      const result = await toggleLike(postId)
      
      setIsLiked(result)
      setLikes(prev => result ? prev + 1 : prev - 1)
    } catch (error) {
      console.error('Error toggling like:', error)
      toast.error('Failed to like post')
    }
  }

  return (
    <>
      <button 
        onClick={handleLike}
        className={`flex items-center gap-2 py-2 ${isLiked ? 'text-brand-pink-main' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'} ${className}`}
      >
        {isLiked ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        )}
        <span 
          className="text-sm cursor-pointer hover:underline"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setShowLikes(true)
          }}
        >
          {likes}
        </span>
      </button>
      <LikesList 
        postId={postId}
        open={showLikes}
        onOpenChange={setShowLikes}
      />
    </>
  )
} 