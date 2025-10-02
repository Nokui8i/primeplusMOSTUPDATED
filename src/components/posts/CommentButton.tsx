import { FiMessageSquare } from 'react-icons/fi'
import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

interface CommentButtonProps {
  onClick: () => void
  comments: number
  postId: string
  className?: string
}

export function CommentButton({ onClick, comments: initialComments, postId, className = '' }: CommentButtonProps) {
  const [commentCount, setCommentCount] = useState(initialComments)

  useEffect(() => {
    // Listen to all comments for this post, including replies
    const commentsRef = collection(db, `posts/${postId}/comments`)
    const unsubscribe = onSnapshot(commentsRef, (snapshot) => {
      setCommentCount(snapshot.size)
    }, (error) => {
      console.error('Error listening to comments:', error)
    })

    return () => unsubscribe()
  }, [postId])

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onClick()
  }

  return (
    <div className={`engagement-button ${className}`} onClick={handleClick}>
      <div className="engagement-main">
        <FiMessageSquare className="engagement-icon" style={{ fill: '#9ca3af' }} />
      </div>
      <span className="engagement-count one">{commentCount}</span>
      <span className="engagement-count two">{commentCount}</span>
    </div>
  )
} 