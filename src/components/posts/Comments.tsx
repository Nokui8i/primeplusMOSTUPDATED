import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { CommentsList } from './CommentsList'
import { createComment } from '@/lib/firebase/db'

interface CommentsProps {
  postId: string
  postAuthorId: string
  currentUserId?: string
  onCommentAdded?: () => void
  parentId?: string | null
  sortBy?: 'newest' | 'oldest'
  commentId?: string | null
  highlight?: boolean
}

export function Comments({ postId, postAuthorId, onCommentAdded, parentId, sortBy = 'newest', commentId, highlight }: CommentsProps) {
  const { user } = useAuth()
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      toast.error('You must be logged in to comment')
      return
    }

    if (!comment.trim()) {
      toast.error('Comment cannot be empty')
      return
    }

    console.log('[Comments] Submitting comment for postId:', postId, 'content:', comment, 'parentId:', parentId);
    setIsSubmitting(true)

    try {
      const commentId = await createComment(postId, comment, user, parentId || undefined)
      console.log('[Comments] Comment created successfully with ID:', commentId);
      setComment('')
      toast.success('Comment added successfully')
      if (onCommentAdded) {
        onCommentAdded()
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      toast.error('Failed to add comment. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Comments List */}
      <CommentsList 
        postId={postId} 
        postAuthorId={postAuthorId} 
        currentUserId={user?.uid || undefined} 
        parentId={parentId || undefined}
        sortBy={sortBy}
        commentId={commentId}
        highlight={highlight}
      />
      
      {/* Comment Input Form */}
      {user && (
        <form onSubmit={handleSubmit} className="flex items-start gap-2">
          <Avatar className="h-6 w-6" style={{ width: '24px', height: '24px' }}>
            <AvatarImage src={user.photoURL || '/default-avatar.png'} alt="Your avatar" />
            <AvatarFallback className="text-xs">{user.displayName?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="comment-input-container">
              {/* Input Field */}
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Message..."
                className="comment-input-field"
                disabled={isSubmitting}
              />
              
              {/* Send Icon */}
              <button
                type="submit"
                disabled={!comment.trim() || isSubmitting}
                className="comment-send-icon"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
} 