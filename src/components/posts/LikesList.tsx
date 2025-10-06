import React, { useEffect, useState } from 'react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import Link from 'next/link'
import { collection, onSnapshot, doc, getDoc, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

interface Like {
  id: string;
  displayName: string;
  photoURL: string;
  username?: string;
  createdAt: any;
}

interface LikesListProps {
  postId: string;
  commentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LikesList({ postId, commentId, open, onOpenChange }: LikesListProps) {
  const [likes, setLikes] = useState<Like[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return // Don't fetch if dialog is closed

    setLoading(true)
    // Construct the path based on whether it's a post or comment like
    const likesPath = commentId 
      ? `posts/${postId}/comments/${commentId}/likes`
      : `posts/${postId}/likes`;
    
    const likesRef = collection(db, likesPath)
    const likesQuery = query(likesRef, orderBy('createdAt', 'desc'), limit(100))
    
    const unsubscribe = onSnapshot(likesQuery, async (snapshot) => {
      const likesData = await Promise.all(snapshot.docs.map(async (likeDoc) => {
        // Get user profile for more accurate display name
        const userDoc = await getDoc(doc(db, 'users', likeDoc.id));
        const userData = userDoc.data();
        
        return {
          id: likeDoc.id,
          displayName: userData?.displayName || likeDoc.data().displayName || 'Anonymous',
          photoURL: userData?.photoURL || likeDoc.data().photoURL || '',
          username: userData?.username || likeDoc.data().username,
          createdAt: likeDoc.data().createdAt,
        }
      }))
      setLikes(likesData)
      setLoading(false)
    })

    return () => {
      unsubscribe()
      setLikes([])
    }
  }, [postId, commentId, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] [&>button]:text-gray-900 dark:[&>button]:text-gray-100">
        <DialogHeader>
          <DialogTitle>Likes</DialogTitle>
          <DialogDescription>
            People who liked this {commentId ? 'comment' : 'post'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            // Loading skeletons
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))
          ) : likes.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400">
              No likes yet
            </p>
          ) : (
            likes.map((like) => (
              <div key={like.id} className="flex items-center space-x-3">
                <Link href={`/profile/${like.username || like.id}`}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={like.photoURL} alt={like.displayName} />
                    <AvatarFallback>
                      {like.displayName[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <Link
                  href={`/profile/${like.username || like.id}`}
                  className="font-medium hover:underline text-gray-900 dark:text-gray-100"
                >
                  {like.displayName}
                </Link>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 