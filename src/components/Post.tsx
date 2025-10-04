import { useState, useEffect, useCallback, forwardRef } from 'react'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { Post as PostType, PostWithAuthor } from '@/lib/types/post'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FiHeart, FiMessageSquare, FiShare2, FiBookmark, FiEye, FiUsers, FiClock } from 'react-icons/fi'
import { Timestamp, doc, getDoc, onSnapshot, deleteDoc, setDoc, serverTimestamp, collection, updateDoc, increment } from 'firebase/firestore'
import Link from 'next/link'
import { toggleLike, toggleSave, deletePost } from '@/lib/firebase/db'
import { auth } from '@/lib/firebase/config'
import { db } from '@/lib/firebase/config'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { LikesList } from '@/components/posts/LikesList'
import { Comments } from '@/components/posts/Comments'
import { CommentsList } from './posts/CommentsList'
import { PostDetailsDialog } from '@/components/posts/PostDetailsDialog'
import MediaContent from '@/components/posts/MediaContent'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import PostOptionsMenu from '@/components/posts/PostOptionsMenu'
import { EditPostDialog } from '@/components/posts/EditPostDialog'
import { CommentButton } from '@/components/posts/CommentButton'
import { LikeButton } from '@/components/posts/LikeButton'
import { motion } from 'framer-motion'
import { Video as VideoIcon, Image as ImageIcon, Type as TextIcon, Box as BoxIcon, Globe as GlobeIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { TextPost } from './TextPost'
import { CommentInput } from '@/components/posts/CommentInput'
import { LiveStreamPost } from '@/components/posts/LiveStreamPost'
import { PostData, PostProps, Comment } from '../types'

export const Post = forwardRef<HTMLDivElement, PostProps>(({ post, onUpdate, onDelete }, ref) => {
  const { user } = useAuth()
  const [currentPost, setCurrentPost] = useState<PostWithAuthor>(() => ({
    ...post,
    type: post.type || 'text',
    isPublic: post.isPublic || false,
    shares: post.shares || 0,
    taggedUsers: post.taggedUsers || [],
    comments: Array.isArray(post.comments) ? post.comments.length : (typeof post.comments === 'number' ? post.comments : 0),
    author: {
      id: post.authorId,
      displayName: post.authorName,
      photoURL: post.author?.photoURL
    }
  }))
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showLikes, setShowLikes] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes || 0)
  const [commentCount, setCommentCount] = useState(Array.isArray(post.comments) ? post.comments.length : (typeof post.comments === 'number' ? post.comments : 0))
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(post.content)

  useEffect(() => {
    }, [post, user?.uid, showComments, currentPost])

  useEffect(() => {
    }, [showComments])

  // Handle post updates with cleanup
  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const setupPostListener = async () => {
      try {
        unsubscribe = onSnapshot(
          doc(db, 'posts', post.id),
          (docSnapshot) => {
            if (docSnapshot.exists()) {
              const data = docSnapshot.data()
              setCurrentPost(prevPost => ({
                ...prevPost,
                ...data,
                comments: typeof data.comments === 'number' ? data.comments : (Array.isArray(data.comments) ? data.comments.length : 0),
                likes: data.likes || 0,
                author: prevPost.author
              }))
              setLikeCount(data.likes || 0)
              setCommentCount(typeof data.comments === 'number' ? data.comments : (Array.isArray(data.comments) ? data.comments.length : 0))
              setError(null)
            } else {
              setError('Post no longer exists')
              onDelete?.(post.id)
            }
          },
          (error) => {
            console.error('Error listening to post:', error)
            setError('Failed to load post updates')
          }
        )
      } catch (err) {
        console.error('Error setting up post listener:', err)
        setError('Failed to set up post listener')
      }
    }

    setupPostListener()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [post.id, onDelete])

  // Handle like action with debounce
  const handleLike = useCallback(async () => {
    if (!user) return

    try {
      const postRef = doc(db, 'posts', post.id)
      const newLikes = isLiked ? post.likes - 1 : post.likes + 1
      
      await updateDoc(postRef, {
        likes: newLikes
      })
      
      setIsLiked(!isLiked)
      setLikeCount(newLikes)
      onUpdate?.({
        ...post,
        likes: newLikes
      })
    } catch (err) {
      console.error('Error updating likes:', err)
      setError('Failed to update likes')
    }
  }, [user, post.id, isLiked, onUpdate])

  // Handle comment action
  const handleComment = useCallback(() => {
    setShowComments(!showComments)
  }, [showComments])

  // Handle save action
  const handleSave = useCallback(async () => {
    if (!user) return

    try {
      const savedPostsRef = doc(db, 'users', user.uid, 'savedPosts', post.id)
      const savedPostDoc = await getDoc(savedPostsRef)

      if (savedPostDoc.exists()) {
        await deleteDoc(savedPostsRef)
        setIsSaved(false)
      } else {
        await updateDoc(savedPostsRef, {
          postId: post.id,
          savedAt: new Date()
        })
        setIsSaved(true)
      }
    } catch (err) {
      console.error('Error saving post:', err)
      setError('Failed to update saved post')
    }
  }, [user, post.id])

  const handleDelete = async () => {
    if (!user || user.uid !== post.authorId) return

    try {
      await deleteDoc(doc(db, 'posts', post.id))
      onDelete?.(post.id)
    } catch (error) {
      console.error('Error deleting post:', error)
    }
  }

  const formatDate = (timestamp: Timestamp | Date | null) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <VideoIcon className="h-5 w-5" />;
      case 'image':
        return <ImageIcon className="h-5 w-5" />;
      case 'text':
        return <TextIcon className="h-5 w-5" />;
      case 'vr':
        return <BoxIcon className="h-5 w-5" />;
      case '360':
        return <GlobeIcon className="h-5 w-5" />;
      case 'story':
        return <TextIcon className="h-5 w-5" />;
      default:
        return <TextIcon className="h-5 w-5" />;
    }
  };

  const handleEdit = async () => {
    if (!user || user.uid !== post.authorId) return

    try {
      const postRef = doc(db, 'posts', post.id)
      await updateDoc(postRef, {
        content: editedContent,
        updatedAt: new Date()
      })

      setIsEditing(false)
      onUpdate?.({
        ...post,
        content: editedContent,
        updatedAt: new Date()
      })
    } catch (error) {
      console.error('Error updating post:', error)
    }
  }

  // Fix createdAt toDate usage
  const getCreatedAtDate = (createdAt: any) => {
    if (!createdAt) return new Date();
    if (createdAt instanceof Date) return createdAt;
    if (typeof createdAt.toDate === 'function') return createdAt.toDate();
    return new Date(createdAt);
  }

  // Add a safety check for rendering
  if (!currentPost?.author) {
    return null // Or return a loading state
  }

  // Add this check before the return statement
  if (currentPost.type === 'live_stream' && currentPost.streamId) {
    return (
      <LiveStreamPost
        streamId={currentPost.streamId}
        title={currentPost.title || ''}
        description={currentPost.content}
        author={{
          id: currentPost.author.id,
          displayName: currentPost.author.displayName || 'Anonymous',
          photoURL: currentPost.author.photoURL || undefined,
          username: currentPost.author.username
        }}
        viewerCount={currentPost.viewerCount || 0}
        createdAt={getCreatedAtDate(currentPost.createdAt)}
        thumbnailUrl={currentPost.thumbnailUrl}
      />
    );
  }

  useEffect(() => {
    // Increment views only once per session per post
    if (!post.id) return;
    const viewedKey = `viewed_post_${post.id}`;
    if (!sessionStorage.getItem(viewedKey)) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dayKey = `${yyyy}-${mm}-${dd}`;
      updateDoc(doc(db, 'posts', post.id), {
        'engagement.views': increment(1),
        [`engagement.viewsByDay.${dayKey}`]: increment(1),
        updatedAt: serverTimestamp()
      })
        .then(() => sessionStorage.setItem(viewedKey, '1'))
        .catch((err) => console.error('[Post] Failed to increment views:', err));
    }
  }, [post.id]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative w-full max-w-3xl mx-auto mb-6" style={{
      background: 'white',
      borderRadius: '17px 17px 27px 27px',
      boxShadow: '0px 187px 75px rgba(0, 0, 0, 0.01), 0px 105px 63px rgba(0, 0, 0, 0.05), 0px 47px 47px rgba(0, 0, 0, 0.09), 0px 12px 26px rgba(0, 0, 0, 0.1), 0px 0px 0px rgba(0, 0, 0, 0.1)'
    }}>
      {currentPost.type === 'text' ? (
        <TextPost post={currentPost} />
      ) : (
        <>
          <div className="pt-0 pb-6 px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="h-14 w-14 rounded-full">
                  <AvatarImage src={currentPost.author?.photoURL || '/default-avatar.png'} alt={currentPost.author?.displayName || 'User avatar'} />
                  <AvatarFallback>{currentPost.author?.displayName?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <Link href={`/profile/${currentPost.author?.username || currentPost.author?.id}`}>
                      <span className="font-semibold text-base text-gray-900 dark:text-gray-100 hover:underline">
                        {currentPost.author?.displayName || 'Anonymous'}
                      </span>
                    </Link>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(
                        getCreatedAtDate(currentPost.createdAt),
                        { addSuffix: true }
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <PostOptionsMenu
                postId={currentPost.id}
                authorId={currentPost.authorId}
                onEdit={() => setIsEditing(true)}
              />
            </div>

            {/* Post Content */}
            <div>
              {isEditing ? (
                <div className="mb-4">
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full p-2 border rounded"
                    rows={3}
                  />
                  <div className="flex justify-end space-x-2 mt-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1 text-gray-600 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEdit}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-base text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
                  {currentPost.content}
                </p>
              )}
            </div>
          </div>

          {/* Media Content */}
          {currentPost.mediaUrl && (
            <div className="border-t border-gray-100 dark:border-gray-700/50 bg-black/5">
              <MediaContent
                url={currentPost.mediaUrl}
                type={currentPost.type || 'image'}
                thumbnailUrl={currentPost.thumbnailUrl}
              />
            </div>
          )}

          {/* Post Actions */}
          <div className="px-6 py-3 flex items-center gap-6">
             <div className="flex flex-col items-center">
               <button 
                 onClick={handleLike}
                 className={`flex items-center gap-1.5 py-1.5 ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
               >
                 {isLiked ? (
                   <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                     <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                   </svg>
                 ) : (
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                     <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                   </svg>
                 )}
                 <span className="text-xs font-medium">{likeCount}</span>
               </button>
             </div>

            <div className="flex flex-col items-center">
              <button
                onClick={handleComment}
                className="flex items-center gap-1.5 py-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
                </svg>
                <span className="text-xs font-medium">{commentCount}</span>
              </button>
            </div>

            <div className="flex flex-col items-center">
              <button
                onClick={handleSave}
                className={`flex items-center space-x-1 ${
                  isSaved ? 'text-blue-500' : 'text-gray-500'
                }`}
              >
                <span>{isSaved ? '🔖' : '📑'}</span>
              </button>
            </div>

            {/* Views counter, only for post author */}
            {user?.uid === currentPost.authorId && (currentPost as any)?.engagement && (
              <div className="flex flex-col items-center">
                <button
                  className="flex items-center gap-1.5 py-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <span className="text-xs font-medium">{(currentPost as any)?.engagement?.views || 0}</span>
                </button>
              </div>
            )}
          </div>

          {/* Comments Section */}
          {showComments && (
            <div className="border-t border-gray-100 dark:border-gray-700">
              <div className="p-4">
                <CommentInput
                  postId={currentPost.id || ''}
                  postAuthorId={currentPost.authorId || ''}
                  onCommentAdded={handleComment}
                />
                <Comments
                  postId={currentPost.id || ''}
                  postAuthorId={currentPost.authorId || ''}
                  onCommentAdded={handleComment}
                />
              </div>
            </div>
          )}
        </>
      )}
      <EditPostDialog
        post={currentPost}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
      <LikesList
        postId={currentPost.id}
        open={showLikes}
        onOpenChange={setShowLikes}
      />
    </div>
  )
}) 