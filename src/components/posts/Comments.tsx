import { useState, useEffect } from 'react'
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
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

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
  post?: any // Add post prop to check access level
}

export function Comments({ postId, postAuthorId, onCommentAdded, parentId, sortBy = 'newest', commentId, highlight, onSortChange, post }: CommentsProps) {
  const { user } = useAuth()
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [canViewComments, setCanViewComments] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0) // Added refresh key

  // Check if user can view comments on this post
  const checkCommentAccess = async () => {
    console.log('[Comments] checkCommentAccess called for post:', post?.id, 'user:', user?.uid);
    
    if (!user || !post) {
      console.log('[Comments] No user or post, allowing access');
      setCanViewComments(true); // Allow if no post data or user
      return;
    }
    
    // Always allow the creator to view comments on their own post
    if (user.uid === post.authorId) {
      console.log('[Comments] User is creator, allowing access');
      setCanViewComments(true);
      return;
    }
    
    // If post is public, allow everyone to view comments
    if (post.isPublic) {
      console.log('[Comments] Post is public, allowing access');
      setCanViewComments(true);
      return;
    }
    
    // Check access level
    const accessLevel = post.accessSettings?.accessLevel;
    console.log('[Comments] Access level:', accessLevel);
    
    // If no access level or free content, allow viewing comments
    if (!accessLevel || accessLevel === 'free') {
      console.log('[Comments] No access level or free content, allowing access');
      setCanViewComments(true);
      return;
    }
    
    // For locked content, check subscription status
    if (accessLevel === 'free_subscriber' || accessLevel === 'followers' || 
        accessLevel === 'paid_subscriber' || accessLevel === 'premium' || 
        accessLevel === 'exclusive') {
      
      try {
        // Check subscription in Firebase
        const q = query(
          collection(db, 'subscriptions'),
          where('subscriberId', '==', user.uid),
          where('creatorId', '==', post.authorId),
          where('status', 'in', ['active', 'cancelled'])
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const now = new Date();
          const hasValidSubscription = querySnapshot.docs.some(doc => {
            const data = doc.data();
            const isActive = data.status === 'active';
            const isCancelledButValid = data.status === 'cancelled' && 
              data.endDate && 
              data.endDate.toDate() > now;
            return isActive || isCancelledButValid;
          });
          
          console.log('[Comments] Has valid subscription:', hasValidSubscription);
          setCanViewComments(hasValidSubscription);
        } else {
          console.log('[Comments] No subscription found, denying access');
          setCanViewComments(false);
        }
      } catch (error) {
        console.error('Error checking subscription for viewing comments:', error);
        setCanViewComments(false);
      }
    } else {
      console.log('[Comments] Unknown access level, denying access');
      setCanViewComments(false);
    }
    
    console.log('[Comments] Final canViewComments result:', canViewComments);
  };

  // Check comment access when component mounts or post changes
  useEffect(() => {
    console.log('[Comments] Checking comment access for post:', post?.id, 'user:', user?.uid);
    checkCommentAccess();
  }, [user, post]);

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
      setRefreshKey(prev => prev + 1) // Force refresh of CommentsList
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
        <div className="px-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 gap-0.5 px-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <ArrowUpDown className="h-2.5 w-2.5" />
                <span className="text-xs">
                  {sortBy === 'newest' ? 'Newest' : 'Oldest'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-24 bg-white">
              <DropdownMenuItem 
                onClick={() => onSortChange('newest')}
                className="text-xs py-0.5"
              >
                Newest First
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onSortChange('oldest')}
                className="text-xs py-0.5"
              >
                Oldest First
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Comments List */}
      {canViewComments ? (
        <div className="comments-list-bubble">
          <CommentsList 
            key={refreshKey} // Force re-render when refreshKey changes
            postId={postId} 
            postAuthorId={postAuthorId} 
            currentUserId={user?.uid || undefined} 
            parentId={parentId || undefined}
            sortBy={sortBy}
            commentId={commentId}
            highlight={highlight}
          />
        </div>
      ) : (
        <div className="comments-locked-message">
          <div className="text-center py-8">
            <div className="text-gray-500 text-sm mb-2">
              🔒 Comments are locked for subscribers only
            </div>
            <div className="text-gray-400 text-xs">
              Subscribe to this creator to view and participate in comments
            </div>
          </div>
        </div>
      )}
      
      {/* Comment Input Form */}
      {user && canViewComments && (
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