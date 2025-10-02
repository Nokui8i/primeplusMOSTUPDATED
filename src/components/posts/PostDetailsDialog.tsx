import { PostWithAuthor } from '@/lib/types/post'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDistanceToNow } from 'date-fns'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import Link from 'next/link'
import MediaContent from './MediaContent'
import { Badge } from '@/components/ui/badge'
import { Timestamp } from 'firebase/firestore'
import { useState, useEffect } from 'react'
import { doc, onSnapshot, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { Hotspot } from '@/lib/types/media'

interface PostDetailsDialogProps {
  post: PostWithAuthor
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PostDetailsDialog({
  post,
  open,
  onOpenChange,
}: PostDetailsDialogProps) {
  const [currentPost, setCurrentPost] = useState(post)
  const [commentCount, setCommentCount] = useState(post.comments || 0)
  const [likeCount, setLikeCount] = useState(post.likes || 0)
  const [shareCount, setShareCount] = useState(post.shares || 0)

  // Transform VR hotspots to the expected format
  const transformHotspots = (vrSettings: any): Hotspot[] | undefined => {
    if (!vrSettings?.hotspots) return undefined;
    return vrSettings.hotspots.map((hotspot: any) => ({
      position: `${hotspot.position.x} ${hotspot.position.y} ${hotspot.position.z}`,
      text: hotspot.content || '',
      rotation: '0 0 0'
    }));
  };

  // Listen for real-time updates to post data
  useEffect(() => {
    if (!open) return; // Only listen when dialog is open

    const unsubscribers: (() => void)[] = [];

    // Listen to post document for updates
    const postRef = doc(db, 'posts', post.id);
    unsubscribers.push(
      onSnapshot(postRef, (doc) => {
        if (doc.exists()) {
          const postData = doc.data();
          setLikeCount(postData.likes || 0);
          setShareCount(postData.shares || 0);
          setCurrentPost(prev => ({ ...prev, ...postData }));
        }
      })
    );

    // Listen to comments collection for real-time count
    const commentsRef = collection(db, `posts/${post.id}/comments`);
    unsubscribers.push(
      onSnapshot(commentsRef, (snapshot) => {
        setCommentCount(snapshot.size);
      })
    );

    // Cleanup function
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [post.id, open]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now'
    if (timestamp instanceof Timestamp) {
      return formatDistanceToNow(timestamp.toDate(), { addSuffix: true })
    }
    if (timestamp instanceof Date) {
      return formatDistanceToNow(timestamp, { addSuffix: true })
    }
    return 'Just now'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Post Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Post Header */}
          <div className="flex items-center space-x-3">
            <Link href={`/profile/${currentPost.authorId}`}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={currentPost.author?.photoURL || ''} alt={currentPost.author?.displayName || 'User'} />
                <AvatarFallback>{currentPost.author?.displayName?.[0] || 'U'}</AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <Link
                href={`/profile/${currentPost.authorId}`}
                className="font-semibold hover:underline"
              >
                {currentPost.author?.displayName || 'Anonymous'}
              </Link>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatDate(currentPost.createdAt)}
              </p>
            </div>
          </div>

          {/* Post Content */}
          <div className="space-y-4">
            {currentPost.content && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {currentPost.content}
                </p>
              </div>
            )}
            {currentPost.mediaUrl && (
              <div className="rounded-lg overflow-hidden">
                <MediaContent
                  url={currentPost.mediaUrl}
                  type={currentPost.type || 'image'}
                  thumbnailUrl={currentPost.thumbnailUrl}
                  hotspots={transformHotspots((currentPost as any).vrSettings)}
                  username={currentPost.author?.username}
                  showWatermark={(currentPost as any).showWatermark !== false}
                />
              </div>
            )}
          </div>

          {/* Post Tags */}
          {currentPost.tags && currentPost.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {currentPost.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Post Stats */}
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <span>{likeCount} likes</span>
            <span>{commentCount} comments</span>
            <span>{shareCount} shares</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 