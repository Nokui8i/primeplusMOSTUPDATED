import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/lib/firebase/auth'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { CommentsList } from './CommentsList'
import { createComment } from '@/lib/firebase/db'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { ArrowUpDown } from 'lucide-react'
import { isUserBlocked } from '@/lib/services/block.service'

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
  const [isBlocked, setIsBlocked] = useState(false)
  const [checkingBlock, setCheckingBlock] = useState(true)

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
    
    // Check if comments are disabled for this specific post
    if (post.allowComments === false) {
      console.log('[Comments] Comments disabled for this post');
      setCanViewComments(false);
      return;
    }
    
    // If post has allowComments set to true, allow viewing comments
    if (post.allowComments === true) {
      console.log('[Comments] Comments enabled for this post');
      setCanViewComments(true);
      return;
    }
    
    // If allowComments is null (use global setting), check user's privacy settings
    if (post.allowComments === null || post.allowComments === undefined) {
      try {
        const postAuthorDoc = await getDoc(doc(db, 'users', post.authorId));
        if (postAuthorDoc.exists()) {
          const postAuthorData = postAuthorDoc.data();
          const globalAllowComments = postAuthorData.privacy?.allowComments;
          
          // If global setting is false, deny viewing comments
          if (globalAllowComments === false) {
            console.log('[Comments] Global comments disabled');
            setCanViewComments(false);
            return;
          }
          
          // If global setting is true or undefined, continue with access level checks
          console.log('[Comments] Global comments enabled, checking access level');
        }
      } catch (error) {
        console.error('Error checking global comment settings:', error);
        // If we can't check global settings, continue with access level checks
      }
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

  // Check if current user is blocked by the post author (one-way blocking)
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!user?.uid || !postAuthorId) {
        setIsBlocked(false);
        setCheckingBlock(false);
        return;
      }
      
      setCheckingBlock(true);
      try {
        // Only check if author blocked current user (one-way blocking)
        const authorBlockedUser = await isUserBlocked(postAuthorId, user.uid);
        
        setIsBlocked(authorBlockedUser);
        console.log('[Comments] Block status:', { 
          authorBlockedUser, 
          blocked: authorBlockedUser, 
          viewer: user.uid, 
          author: postAuthorId 
        });
      } catch (error) {
        console.error('Error checking block status:', error);
        setIsBlocked(false);
      } finally {
        setCheckingBlock(false);
      }
    };
    
    checkBlockStatus();
  }, [user?.uid, postAuthorId]);

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

  // Show loading state while checking block status
  if (checkingBlock) {
    return (
      <div className="comments-bubble-container p-4 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  // Completely hide blocked content - no message shown
  if (isBlocked) {
    return null;
  }

  return (
    <div className="comments-bubble-container">
      {/* Sort Filter and Locked Message - Inside comments window */}
      <div className="px-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
         <div className="flex items-center justify-center gap-2">
           {/* Sort Filter - Only show when comments are accessible */}
           {onSortChange && canViewComments && (
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <button className="px-2 py-1 rounded-full flex items-center gap-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition-all duration-200 focus:outline-none focus:ring-0">
                   <ArrowUpDown className="h-3 w-3" />
                   <span className="text-xs font-medium">
                     {sortBy === 'newest' ? 'Newest' : 'Oldest'}
                   </span>
                 </button>
               </DropdownMenuTrigger>
               <DropdownMenuContent 
                 align="start" 
                 className="w-28 bg-white border-0 overflow-hidden p-0"
                 style={{
                   borderRadius: '12px',
                   boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
                   background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                 }}
               >
                 <DropdownMenuItem 
                   onClick={() => onSortChange('newest')}
                   className="cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200"
                   style={{ fontWeight: '500', fontSize: '12px' }}
                 >
                   Newest First
                 </DropdownMenuItem>
                 <DropdownMenuItem 
                   onClick={() => onSortChange('oldest')}
                   className="cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200"
                   style={{ fontWeight: '500', fontSize: '12px' }}
                 >
                   Oldest First
                 </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>
           )}
           
           {/* Comments Locked Message - Only show when comments are locked */}
           {!canViewComments && (
             <div className="px-2 py-1 rounded-full flex items-center gap-1 bg-white border border-gray-200 text-gray-700 shadow-sm">
               <span className="text-xs font-medium">🔒</span>
               <span className="text-xs font-medium">
                 Comments are locked
               </span>
             </div>
           )}
         </div>
      </div>

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
      ) : null}
      
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