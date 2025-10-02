import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, doc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

interface Comment {
  id: string
  content: string
  authorId: string
  authorDisplayName: string
  authorPhotoURL: string
  createdAt: Timestamp
  parentCommentId: string | null
}

interface CommentCounterProps {
  postId: string
  count: number
}

export function CommentCounter({ postId, count: initialCount }: CommentCounterProps) {
  const [showComments, setShowComments] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Listen for real-time updates to both post's comment count and comments
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Listen to post document for count
    const postRef = doc(db, 'posts', postId);
    unsubscribers.push(
      onSnapshot(postRef, (doc) => {
        if (doc.exists()) {
          const postData = doc.data();
          setCount(Math.max(0, postData.comments || 0));
        }
      })
    );

    // Always listen to comments, not just when dialog is open
    const commentsRef = collection(db, `posts/${postId}/comments`);
    const commentsQuery = query(commentsRef, orderBy('createdAt', 'desc'));
    
    setIsLoading(true);
    unsubscribers.push(
      onSnapshot(commentsQuery, 
        (snapshot) => {
          const commentsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          } as Comment));
          
          setComments(commentsData);
          setIsLoading(false);
        },
        (error) => {
          console.error('Error listening to comments:', error);
          setIsLoading(false);
        }
      )
    );

    // Cleanup function to unsubscribe from all listeners
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [postId]); // Only depend on postId

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowComments(true)}
        className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
      >
        {count} comments
      </Button>

      <Dialog open={showComments} onOpenChange={setShowComments}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comments ({count})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-4">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No comments yet</div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <Link href={`/profile/${comment.authorId}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={comment.authorPhotoURL || '/default-avatar.png'} alt={comment.authorDisplayName} />
                        <AvatarFallback>{comment.authorDisplayName?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div>
                      <Link href={`/profile/${comment.authorId}`}>
                        <span className="text-sm font-medium hover:underline">
                          {comment.authorDisplayName}
                        </span>
                      </Link>
                      <p className="text-sm text-gray-500">
                        {formatDistanceToNow(
                          comment.createdAt instanceof Date 
                            ? comment.createdAt 
                            : comment.createdAt?.toDate() || new Date(),
                          { addSuffix: true }
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 pl-11">
                    {comment.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
} 