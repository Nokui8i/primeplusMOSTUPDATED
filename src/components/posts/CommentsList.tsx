import React, { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, where, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatDistanceToNow } from 'date-fns'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import Link from 'next/link'
import { Comment } from './Comment'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CommentsListProps {
  postId: string
  postAuthorId: string
  currentUserId?: string
  parentId?: string
  className?: string
  sortBy?: 'newest' | 'oldest'
  commentId?: string | null
  highlight?: boolean
}

interface CommentType {
  id: string
  content: string
  authorId: string
  authorDisplayName: string
  authorPhotoURL?: string
  authorUsername?: string
  createdAt: any
  updatedAt: any
  likes: number
  isEdited: boolean
  parentId?: string
  repliesCount: number
}

type SortOption = 'newest' | 'oldest' | 'more'

export function CommentsList({ postId, postAuthorId, currentUserId, parentId, className, sortBy = 'newest', commentId, highlight }: CommentsListProps) {
  const [comments, setComments] = useState<CommentType[]>([])
  const [loading, setLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(!!commentId)
  const [page, setPage] = useState(1)
  const INITIAL_COMMENTS_TO_SHOW = 3
  const COMMENTS_PER_PAGE = 20

  useEffect(() => {
    if (commentId) setIsExpanded(true);
  }, [commentId]);

  useEffect(() => {
    console.log('[CommentsList] Setting up listener for postId:', postId, 'parentId:', parentId, 'sortBy:', sortBy);
    console.log('[CommentsList] Component mounted/updated, setting up new listener');
    
    const commentsRef = collection(db, 'comments')
    // For top-level comments, parentId should be null
    const targetParentId = parentId === undefined ? null : parentId;
    console.log('[CommentsList] Target parentId:', targetParentId);
    
    // Query comments for this specific post - use simpler query to avoid index requirement
    const q = query(
      commentsRef,
      where('postId', '==', postId)
      // Remove orderBy to avoid composite index requirement
    );
    
    console.log('[CommentsList] Query created:', q);
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log('[CommentsList] Snapshot received, docs count:', snapshot.docs.length);
      console.log('[CommentsList] Snapshot metadata:', snapshot.metadata);
      console.log('[CommentsList] Snapshot fromCache:', snapshot.metadata.fromCache);
      
      // Filter comments by parentId in memory
      const filteredDocs = snapshot.docs.filter(doc => {
        const data = doc.data();
        const commentParentId = data.parentId || data.parentCommentId || null;
        return commentParentId === targetParentId;
      });
      
      console.log('[CommentsList] Filtered comments:', filteredDocs.length);
      
      const commentsData = await Promise.all(filteredDocs.map(async (docSnapshot) => {
        const data = docSnapshot.data()
        
        // Check if data exists before processing
        if (!data) {
          console.warn('[CommentsList] No data found for comment:', docSnapshot.id);
          return null; // Skip this comment
        }
        
        console.log('[CommentsList] Processing comment:', docSnapshot.id, data);
        console.log('[CommentsList] Comment data fields:', {
          authorId: data.authorId,
          authorDisplayName: data.authorDisplayName,
          authorUsername: data.authorUsername,
          authorPhotoURL: data.authorPhotoURL
        });
        
        // Check if authorId exists before trying to fetch user profile
        let photoURL = data.authorPhotoURL || undefined;
        let username = data.authorUsername || undefined;
        let userProfile = null; // Declare userProfile outside the if block
        
        if (data.authorId) {
          try {
            const authorId = data.authorId || data.userId;
            if (!authorId) {
              console.error('[CommentsList] No author ID found for comment:', data.id);
              return;
            }
            console.log('[CommentsList] Fetching user profile for authorId:', authorId);
            const userProfileDoc = await getDoc(doc(db, 'users', authorId));
            userProfile = userProfileDoc.data();
            console.log('[CommentsList] User profile data:', userProfile);
            photoURL = userProfile?.photoURL || data.authorPhotoURL || undefined;
            username = userProfile?.username || data.authorUsername || undefined;
            console.log('[CommentsList] Final values - photoURL:', photoURL, 'username:', username);
          } catch (error) {
            console.error('[CommentsList] Error fetching user profile for authorId:', data.authorId, error);
            // Fall back to the data already in the comment
          }
        } else {
          console.warn('[CommentsList] No authorId found for comment:', docSnapshot.id, 'Using fallback data');
          // For old comments without authorId, try to get user data from other fields
          if (data.userId) {
            try {
              console.log('[CommentsList] Trying to fetch user profile for old comment with userId:', data.userId);
              const userProfileDoc = await getDoc(doc(db, 'users', data.userId));
              userProfile = userProfileDoc.data();
              console.log('[CommentsList] User profile data for old comment:', userProfile);
              photoURL = userProfile?.photoURL || data.authorPhotoURL || undefined;
              username = userProfile?.username || data.authorUsername || undefined;
            } catch (error) {
              console.error('[CommentsList] Error fetching user profile for old comment userId:', data.userId, error);
            }
          }
        }
        
        // Get replies count for this comment
        const repliesQuery = query(
          commentsRef, 
          orderBy('createdAt', 'desc')
        );
        const repliesSnapshot = await getDocs(repliesQuery);
        const repliesCount = repliesSnapshot.docs.filter(doc => {
          const replyData = doc.data();
          const replyParentId = replyData.parentId || replyData.parentCommentId || null;
          return replyParentId === docSnapshot.id;
        }).length;
        
        const commentData = {
          id: docSnapshot.id,
          content: data.content,
          authorId: data.authorId,
          authorDisplayName: userProfile?.displayName || data.authorDisplayName || 'Anonymous',
          authorPhotoURL: photoURL,
          authorUsername: username,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          likes: data.likes || 0,
          isEdited: data.isEdited || false,
          parentId: data.parentId || data.parentCommentId || null, // Use parentId if available, fallback to parentCommentId
          repliesCount
        } as CommentType;
        
        console.log('[CommentsList] Final comment data:', commentData);
        return commentData;
      }))

      // Filter out null and undefined values (comments with no data)
      const validComments = commentsData.filter(comment => comment !== null && comment !== undefined);
      
      // Sort comments client-side since we removed orderBy from query
      const sortedComments = validComments.sort((a, b) => {
        if (!a || !b) return 0;
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        
        if (sortBy === 'newest') {
          return bTime.getTime() - aTime.getTime(); // Newest first
        } else {
          return aTime.getTime() - bTime.getTime(); // Oldest first
        }
      });
      
      console.log('[CommentsList] Processed and sorted comments:', sortedComments);
      setComments(sortedComments)
      setLoading(false)
    }, (error) => {
      console.error('[CommentsList] Error in onSnapshot:', error);
      setLoading(false)
    });
    
    return () => unsubscribe();
  }, [postId, parentId, sortBy])

  const visibleComments = isExpanded 
    ? comments.slice(0, page * COMMENTS_PER_PAGE)
    : comments.slice(0, INITIAL_COMMENTS_TO_SHOW)

  const hasMoreComments = isExpanded && comments.length > page * COMMENTS_PER_PAGE
  const hasHiddenComments = comments.length > INITIAL_COMMENTS_TO_SHOW

  const loadMore = () => {
    setPage(prev => prev + 1)
  }

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-8 w-3/4 rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("space-y-0", className)}>
      <div className="space-y-0 max-h-[500px] overflow-y-auto">
        {visibleComments.map((comment) => (
          <CommentWithReplies
            key={comment.id}
            comment={comment}
            postId={postId}
            postAuthorId={postAuthorId}
            currentUserId={currentUserId}
            allComments={comments}
            commentId={commentId}
            highlight={highlight}
          />
        ))}
      </div>
      {!isExpanded && hasHiddenComments && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="w-full text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 h-7 flex items-center justify-center gap-1"
        >
          <ChevronDown className="h-3 w-3" />
          Show more comments
        </Button>
      )}
      {isExpanded && hasMoreComments && (
        <Button
          variant="ghost"
          size="sm"
          onClick={loadMore}
          className="w-full text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 h-7"
        >
          Load more comments
        </Button>
      )}
    </div>
  )
}

// Recursive component to render a comment and its direct replies
interface CommentWithRepliesProps {
  comment: CommentType;
  postId: string;
  postAuthorId: string;
  currentUserId?: string;
  allComments: CommentType[];
  commentId?: string | null;
  highlight?: boolean;
}

function CommentWithReplies({ comment, postId, postAuthorId, currentUserId, allComments, commentId, highlight }: CommentWithRepliesProps) {
  // Only render the main comment bubble, do not render replies
  return (
    <Comment
      id={comment.id}
      postId={postId}
      postAuthorId={postAuthorId}
      content={comment.content}
      author={{
        id: comment.authorId,
        displayName: comment.authorDisplayName,
        photoURL: comment.authorPhotoURL,
        username: comment.authorUsername
      }}
      createdAt={comment.createdAt}
      currentUserId={currentUserId}
      likes={comment.likes}
      parentId={comment.parentId}
      commentId={commentId}
      highlight={highlight}
    />
  );
} 