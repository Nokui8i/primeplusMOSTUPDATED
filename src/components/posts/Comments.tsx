import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { CommentsList } from './CommentsList'
import { createComment } from '@/lib/firebase/db'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ArrowUpDown } from 'lucide-react'

interface CommentsProps {
  postId: string
  postAuthorId: string
  currentUserId?: string
  onCommentAdded?: () => void
  parentId?: string | null
  sortBy?: 'newest' | 'oldest'
  commentId?: string | null
  highlight?: boolean
  onSortChange?: (sortBy: 'newest' | 'oldest') => void
}

export function Comments({ postId, postAuthorId, onCommentAdded, parentId, sortBy = 'newest', commentId, highlight, onSortChange }: CommentsProps) {
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
    <div className="comments-bubble-container">
      {/* Sort Filter - Inside comments window */}
      {onSortChange && (
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <ArrowUpDown className="h-3 w-3" />
                <span className="text-xs">
                  {sortBy === 'newest' ? 'Newest' : 'Oldest'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              <DropdownMenuItem 
                onClick={() => onSortChange('newest')}
                className="text-xs py-1.5"
              >
                Newest First
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onSortChange('oldest')}
                className="text-xs py-1.5"
              >
                Oldest First
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Comments List */}
      <div className="comments-list-bubble">
        <CommentsList 
          postId={postId} 
          postAuthorId={postAuthorId} 
          currentUserId={user?.uid || undefined} 
          parentId={parentId || undefined}
          sortBy={sortBy}
          commentId={commentId}
          highlight={highlight}
        />
      </div>
      
      {/* Comment Input Form */}
      {user && (
        <div className="comment-input-bubble">
          <form onSubmit={handleSubmit} className="comment-form-3d">
            <Avatar className="comment-avatar" style={{ width: '32px', height: '32px' }}>
              <AvatarImage src={user.photoURL || '/default-avatar.png'} alt="Your avatar" />
              <AvatarFallback className="text-xs">{user.displayName?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div className="comment-input-wrapper">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Message..."
                className="comment-input-3d"
                disabled={isSubmitting}
              />
              
              {/* Send Icon */}
              <button
                type="submit"
                disabled={!comment.trim() || isSubmitting}
                className="comment-send-3d"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
} 