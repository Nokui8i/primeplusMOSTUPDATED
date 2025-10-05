/**
 * 🔒 PROTECTED COMPONENT - Core Post Display
 * 
 * This component is critical for post display and interaction. Modifications require:
 * 1. Explicit approval from the project maintainer
 * 2. Testing of all post-related features
 * 3. Documentation updates in CHANGELOG.md
 * 
 * Protected Features:
 * - Post display
 * - Like functionality
 * - Comment display
 * - Real-time updates
 * 
 * Last Modified: 2024-04-08
 * Version: stable-v1.0
 */

import { useState, useEffect, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { PostWithAuthor } from '@/lib/types/post'
import { doc, onSnapshot, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp, addDoc, increment } from 'firebase/firestore'
import Link from 'next/link'
import { db } from '@/lib/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { useCommentCount } from '@/hooks/useCommentCount'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import PostOptionsMenu from '@/components/posts/PostOptionsMenu'
import MediaContent from '@/components/posts/MediaContent'
import { LikeButton } from '@/components/posts/LikeButton'
import { HeartButton } from '@/components/ui/HeartButton'
import { CommentButton } from '@/components/ui/CommentButton'
import { Badge } from '@/components/ui/badge'
import { PostDetailsDialog } from '@/components/posts/PostDetailsDialog'
import { EditPostDialog } from '@/components/posts/EditPostDialog'
import { Comments } from '@/components/posts/Comments'
import { toast } from 'react-hot-toast'
import { deletePost, toggleLike, getUserProfile, createComment } from '@/lib/firebase/db'
import { LikesList } from '@/components/posts/LikesList'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { X, ArrowUpDown, Lock, Play } from 'lucide-react'
import { Hotspot } from '@/lib/types/media'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createNotification } from '@/lib/firebase/db'
import { LiveStreamPost } from '@/components/posts/LiveStreamPost'
import PlansModal from '@/components/creator/PlansModal'
import { FiEye } from 'react-icons/fi'

interface CompactPostProps {
  post: PostWithAuthor
  currentUserId?: string
  onPostDeleted?: (postId: string) => void
  commentId?: string | null
  highlight?: boolean
  showAsGridItem?: boolean
  showAsGalleryOnly?: boolean
}

interface Subscription {
  id: string;
  status: 'active' | 'cancelled';
  endDate?: {
    toDate: () => Date;
  } | Date;
  planId?: string;
}

// Helper function to determine the correct isPublic value
function determineCorrectIsPublic(post: any): boolean {
  // If isPublic is explicitly set to true, respect it
  if (post.isPublic === true) {
    return true;
  }
  
  // If isPublic is explicitly set to false, check if it should actually be public
  if (post.isPublic === false) {
    // If there are no access settings, it should be public
    if (!post.accessSettings) {
      return true;
    }
    
    // If access level is 'free' or undefined, it should be public
    const accessLevel = post.accessSettings.accessLevel;
    if (!accessLevel || accessLevel === 'free') {
      return true;
    }
    
    // For other access levels, respect the false value (it's intentionally locked)
    return false;
  }
  
  // If isPublic is undefined, default to public
  return true;
}

// Helper function to convert Firestore Timestamp or Date to Date
function toDate(date: { toDate: () => Date } | Date): Date {
  return date instanceof Date ? date : date.toDate();
}

export function CompactPost({ post, currentUserId, onPostDeleted, commentId, highlight, showAsGridItem = false, showAsGalleryOnly = false }: CompactPostProps) {
  const { user } = useAuth()
  const { commentCount, loading: commentCountLoading } = useCommentCount(post.id)
  const [currentPost, setCurrentPost] = useState<PostWithAuthor>(() => {
    const correctedPost = {
      ...post,
      isPublic: determineCorrectIsPublic(post), // Use intelligent logic
    }
    console.log('[CompactPost] Initial post data:', {
      postId: post.id,
      originalIsPublic: post.isPublic,
      correctedIsPublic: correctedPost.isPublic,
      accessSettings: post.accessSettings
    })
    return correctedPost
  })
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showLikes, setShowLikes] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [authorDisplayName, setAuthorDisplayName] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(post.content || '')
  const [comment, setComment] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [isSubscriber, setIsSubscriber] = useState(false)
  const [subChecked, setSubChecked] = useState(false)
  const [showPlansModal, setShowPlansModal] = useState(false)
  const [plans, setPlans] = useState<any[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [userSubscription, setUserSubscription] = useState<any>(null)
  const [userPlan, setUserPlan] = useState<any>(null)
  const [canInteract, setCanInteract] = useState(true) // Added state for interaction permissions

  // Debug logging for canInteract changes
  useEffect(() => {
    console.log('[CompactPost] canInteract changed to:', canInteract, 'for post:', currentPost.id);
  }, [canInteract, currentPost.id]);

  // Listen for post updates including comment count and likes
  useEffect(() => {
    const postRef = doc(db, 'posts', post.id);
    const unsubscribe = onSnapshot(
      postRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const correctedData = {
            ...data,
            isPublic: determineCorrectIsPublic(data), // Use intelligent logic
          }
          console.log('[CompactPost] Real-time update received:', {
            postId: post.id,
            originalIsPublic: data.isPublic,
            correctedIsPublic: correctedData.isPublic,
            accessSettings: data.accessSettings,
            comments: data.comments,
            likes: data.likes
          })
          setCurrentPost(prevPost => ({
            ...prevPost,
            ...correctedData,
            author: prevPost.author,
            comments: data.comments !== undefined ? data.comments : (prevPost.comments || 0),
            likes: data.likes !== undefined ? data.likes : (prevPost.likes || 0)
          }));
        }
      },
      (error) => {
        console.error('Error listening to post updates:', error);
      }
    );

    return () => unsubscribe();
  }, [post.id]);

  // Check if the post is liked by the current user and listen for changes
  useEffect(() => {
    if (!user) return;

    const likeRef = doc(db, 'posts', post.id, 'likes', user.uid);
    const unsubscribe = onSnapshot(
      likeRef,
      (docSnapshot) => {
        setIsLiked(docSnapshot.exists());
      },
      (error) => {
        console.error('Error checking like status:', error);
      }
    );

    return () => unsubscribe();
  }, [post.id, user]);

  useEffect(() => {
    const fetchAuthorDisplayName = async () => {
      if (currentPost.authorId) {
        const userDoc = await getDoc(doc(db, 'users', currentPost.authorId))
        const userData = userDoc.data()
        setAuthorDisplayName(userData?.displayName || 'Anonymous')
      }
    }
    fetchAuthorDisplayName()
  }, [currentPost.authorId])

  useEffect(() => {
    async function checkSubscriptionAndPlan() {
      console.log('[CompactPost] Checking subscription for post:', {
        postId: currentPost.id,
        isPublic: currentPost.isPublic,
        isPublicType: typeof currentPost.isPublic,
        isPublicStrictCheck: currentPost.isPublic !== false,
        authorId: currentPost.authorId,
        userId: user?.uid,
        accessSettings: currentPost.accessSettings
      });
      
      if (!user) {
        // For public posts, allow interaction even without login
        if (currentPost.isPublic !== false) {
          console.log('[CompactPost] No user but post is public, allowing interaction');
          console.log('[CompactPost] isPublic check result:', currentPost.isPublic !== false);
          setIsSubscriber(false);
          setCanInteract(true);
          setUserSubscription(null);
          setUserPlan(null);
          setSubChecked(true);
          return;
        }
        // For locked posts, block interaction without login
        console.log('[CompactPost] No user and post is locked, blocking interaction');
        console.log('[CompactPost] isPublic check result:', currentPost.isPublic !== false);
        setIsSubscriber(false);
        setCanInteract(false);
        setUserSubscription(null);
        setUserPlan(null);
        setSubChecked(true);
        return;
      }
      
      // Always allow the creator to view their own content
      if (user.uid === currentPost.authorId) {
        console.log('[CompactPost] User is creator, allowing interaction');
        setIsSubscriber(true);
        setCanInteract(true);
        setUserSubscription(null);
        setUserPlan(null);
        setSubChecked(true);
        return;
      }
      // Always allow public posts (treat undefined as public by default)
      if (currentPost.isPublic !== false) {
        console.log('[CompactPost] Post is public (or undefined), allowing interaction');
        console.log('[CompactPost] isPublic value:', currentPost.isPublic);
        console.log('[CompactPost] isPublic !== false result:', currentPost.isPublic !== false);
        setIsSubscriber(true);
        setCanInteract(true);
        setUserSubscription(null);
        setUserPlan(null);
        setSubChecked(true);
        return;
      }
      // Query for any valid subscription (active or cancelled but not expired)
      console.log('[CompactPost] Post is locked, checking subscription for:', {
        subscriberId: user.uid,
        creatorId: currentPost.authorId
      });
      const q = query(
        collection(db, 'subscriptions'),
        where('subscriberId', '==', user.uid),
        where('creatorId', '==', currentPost.authorId),
        where('status', 'in', ['active', 'cancelled'])
      );
      const querySnapshot = await getDocs(q);
      console.log('[CompactPost] Subscription query result:', {
        docsCount: querySnapshot.docs.length,
        docs: querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      });
      if (!querySnapshot.empty) {
        const now = new Date();
        console.log('[CompactPost] Processing subscriptions, current time:', now);
        // Find the most recent valid subscription
        const validSub = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Subscription))
          .find(sub => {
            const isValid = sub.status === 'active' ||
              (sub.status === 'cancelled' && sub.endDate && toDate(sub.endDate) > now);
            console.log('[CompactPost] Subscription validation:', {
              subId: sub.id,
              status: sub.status,
              endDate: sub.endDate,
              isValid: isValid
            });
            return isValid;
          });
        console.log('[CompactPost] Valid subscription found:', validSub ? 'YES' : 'NO');
        if (validSub) {
          console.log('[CompactPost] Setting user as subscriber with valid subscription');
          setUserSubscription(validSub);
          // Fetch the plan
          const planId = validSub.planId;
          if (planId) {
            const planRef = doc(db, 'plans', planId);
            const planSnap = await getDoc(planRef);
            if (planSnap.exists()) {
              setUserPlan(planSnap.data());
            } else {
              setUserPlan(null);
            }
          } else {
            setUserPlan(null);
          }
          setIsSubscriber(true);
          setCanInteract(true);
        } else {
          console.log('[CompactPost] No valid subscription found, blocking interaction');
          setUserSubscription(null);
          setUserPlan(null);
          setIsSubscriber(false);
          setCanInteract(false);
        }
      } else {
        console.log('[CompactPost] No subscriptions found, blocking interaction');
        setUserSubscription(null);
        setUserPlan(null);
        setIsSubscriber(false);
        setCanInteract(false);
      }
      setSubChecked(true);
    }
    checkSubscriptionAndPlan();
  }, [user, currentPost.authorId, currentPost.isPublic, currentPost.accessSettings]);

  // Listen to likes count changes
  useEffect(() => {
    if (!currentPost?.id) return;

    const likesRef = collection(db, `posts/${currentPost.id}/likes`);
    const unsubscribe = onSnapshot(likesRef, (snapshot) => {
      const likesCount = snapshot.docs.length;
      setCurrentPost(prev => prev ? { ...prev, likes: likesCount } : null);
    });

    return () => unsubscribe();
  }, [currentPost?.id]);

  // Comment count is now updated via the main post listener to avoid multiple listeners

  // Fetch creator's active plans for the modal
  useEffect(() => {
    if (!post.authorId) return;
    setPlansLoading(true);
    const fetchPlans = async () => {
      try {
        const q = query(
          collection(db, 'plans'),
          where('creatorId', '==', post.authorId)
        );
        const snap = await getDocs(q);
        const plansData = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            price: data.price || 0,
            duration: data.duration || 30,
            isActive: data.isActive || false,
            allowedCategories: data.allowedCategories || [],
            description: data.description,
            discountPercent: data.discountPercent,
            totalPrice: data.totalPrice,
            creatorId: data.creatorId || post.authorId
          };
        });
        setPlans(plansData);
      } catch (err) {
        setPlans([]);
      } finally {
        setPlansLoading(false);
      }
    };
    fetchPlans();
  }, [post.authorId]);

  // Auto-open comments if commentId is present (from notification)
  useEffect(() => {
    if (commentId) setShowComments(true);
  }, [commentId]);

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
        .catch((err) => console.error('[CompactPost] Failed to increment views:', err));
    }
  }, [post.id]);

  const handleLike = async () => {
    console.log('handleLike called!', { currentPostId: currentPost.id, isLiked, user: user?.uid });
    if (!user) {
      toast.error('Please sign in to like posts')
      return
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      const userData = userDoc.data()
      const displayName = userData?.displayName || 'Anonymous'

      console.log('Calling toggleLike with postId:', currentPost.id);

      const result = await toggleLike(currentPost.id)
      
      console.log('toggleLike result:', result);
      setIsLiked(result)
    } catch (error) {
      console.error('Error toggling like:', error)
      toast.error('Failed to like post')
    }
  }

  const handleComment = () => {
    if (!user) {
      toast.error('Please sign in to comment');
      return;
    }
    setShowComments(!showComments);
  };

  const handleCommentAdded = () => {
    // Open comments section when a new comment is added
    setShowComments(true)
    // The comment count will be updated automatically through the onSnapshot listener
  };

  const handleDelete = async () => {
    if (!user) {
      toast.error('Please sign in to delete posts');
      return;
    }

    if (!currentPost?.id) {
      toast.error('Invalid post data');
      return;
    }

    try {
      const confirmed = window.confirm('Are you sure you want to delete this post? This action cannot be undone.');
      if (!confirmed) return;

      await deletePost(currentPost.id, user.uid);
      toast.success('Post deleted successfully');
      if (onPostDeleted) {
        onPostDeleted(currentPost.id);
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to delete post');
      }
    }
  };

  const handleEdit = () => {
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!user || !editedContent.trim()) return
    
    try {
      const userProfile = await getUserProfile(currentPost.authorId);
      const updatedPost = {
        ...currentPost,
        content: editedContent.trim(),
        authorDisplayName: userProfile?.displayName || null,
        updatedAt: serverTimestamp()
      };
      const postRef = doc(db, 'posts', currentPost.id)
      await updateDoc(postRef, updatedPost)
      setIsEditing(false)
      toast.success('Post updated successfully')
    } catch (error) {
      console.error('Error updating post:', error)
      toast.error('Failed to update post')
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedContent(currentPost.content || '')
  }

  const handleCommandInputChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setComment(value);
    const cursorPos = e.target.selectionStart || 0;
    setCursorPosition(cursorPos);
    const textBeforeCursor = value.substring(0, cursorPos);
    const match = textBeforeCursor.match(/@(\w*)$/);
    if (match) {
      const searchTerm = match[1];
      setSearchTerm(searchTerm);
      if (searchTerm) {
        try {
          const usersRef = collection(db, 'users');
          const q = query(
            usersRef,
            where('username', '>=', searchTerm),
            where('username', '<=', searchTerm + '\uf8ff')
          );
          const querySnapshot = await getDocs(q);
          const results = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              username: data.username || '',
              photoURL: data.photoURL,
              privacy: data.privacy
            };
          });
          const filtered = results.filter(user => user.privacy?.allowTagging !== false);
          setSearchResults(filtered);
          setShowResults(true);
          // Calculate dropdown position
          if (inputRef.current) {
            const input = inputRef.current;
            const textBeforeCursor = value.substring(0, cursorPos);
            const span = document.createElement('span');
            span.style.visibility = 'hidden';
            span.style.position = 'absolute';
            span.style.whiteSpace = 'pre';
            span.style.font = window.getComputedStyle(input).font;
            span.textContent = textBeforeCursor;
            document.body.appendChild(span);
            const textWidth = span.offsetWidth;
            document.body.removeChild(span);
            setDropdownPosition({ top: input.offsetTop + input.offsetHeight, left: textWidth + input.offsetLeft });
          }
        } catch (error) {
          console.error('Error searching users:', error);
        }
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    } else {
      setShowResults(false);
    }
  };

  const handleUserSelect = (selectedUser: any) => {
    const beforeCursor = comment.substring(0, cursorPosition).replace(/@\w*$/, '');
    const afterCursor = comment.substring(cursorPosition);
    const newComment = `${beforeCursor}@${selectedUser.username} ${afterCursor}`;
    setComment(newComment);
    setShowResults(false);
    if (inputRef.current) {
      const newCursorPos = beforeCursor.length + selectedUser.username.length + 2;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      toast.error('Please sign in to use commands')
      return
    }

    if (!comment.trim()) {
      toast.error('Command cannot be empty')
      return
    }

    console.log('[CompactPost] Submitting command for postId:', currentPost.id, 'content:', comment);
    
    try {
      // Use the unified createComment function
      const commentId = await createComment(currentPost.id, comment.trim(), user, undefined)
      console.log('[CompactPost] Command created successfully with ID:', commentId);
      
      setComment('')
      setShowResults(false)
      toast.success('Command posted!')
    } catch (error) {
      console.error('Error creating comment:', error)
      toast.error('Failed to create comment: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  // Helper: determine if user can view post
  const canViewPost = (() => {
    // Always allow the creator to view their own post
    if (user && user.uid === post.authorId) return true;
    
    // If post is public, allow everyone to view
    if (post.isPublic) return true;
    
    // Normalize access level (handle both new and legacy values)
    const accessLevel = (post as any).accessSettings?.accessLevel as 'free' | 'premium' | 'exclusive' | 'followers' | 'free_subscriber' | 'paid_subscriber' | undefined;
    
    // If no access level is set, treat as free content
    if (!accessLevel || accessLevel === 'free') return true;
    
    // For locked content, check subscription status
    if (accessLevel === 'free_subscriber' || accessLevel === 'followers') {
      // Any valid subscription (active or cancelled but not expired)
      if (!userSubscription) return false;
      const isActive = userSubscription.status === 'active';
      const isCancelledButValid = userSubscription.status === 'cancelled' &&
        userSubscription.endDate &&
        (userSubscription.endDate.toDate ? userSubscription.endDate.toDate() : new Date(userSubscription.endDate)).getTime() > Date.now();
      return isActive || isCancelledButValid;
    }
    
    if (accessLevel === 'paid_subscriber' || accessLevel === 'premium' || accessLevel === 'exclusive') {
      // Only valid paid subscriptions (active or cancelled but not expired, and plan.price > 0)
      if (!userSubscription || !userPlan) return false;
      const isActive = userSubscription.status === 'active';
      const isCancelledButValid = userSubscription.status === 'cancelled' &&
        userSubscription.endDate &&
        (userSubscription.endDate.toDate ? userSubscription.endDate.toDate() : new Date(userSubscription.endDate)).getTime() > Date.now();
      return (isActive || isCancelledButValid) && userPlan.price > 0;
    }
    
    // If access level is not recognized, deny access
    return false;
  })();

  // Render grid item if showAsGridItem is true
  if (showAsGridItem) {
    return (
      <div className="w-full h-full relative">
        {subChecked ? (
          post.mediaUrl && (
            canViewPost ? (
              <div className="w-full h-full relative group">
                {/* Thumbnail/First Frame Display */}
                {post.type === 'image' || post.type === 'image360' ? (
                  <img
                    src={post.mediaUrl}
                    alt="Post thumbnail"
                    className="w-full h-full object-cover rounded-lg"
                    draggable="false"
                  />
                ) : (
                  // Video thumbnail (first frame or custom thumbnail)
                  <div className="relative w-full h-full">
                    {post.thumbnailUrl ? (
                      <img
                        src={post.thumbnailUrl}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover rounded-lg"
                        draggable="false"
                      />
                    ) : (
                      <video
                        src={post.mediaUrl}
                        className="w-full h-full object-cover rounded-lg"
                        preload="metadata"
                        muted
                        playsInline
                        onLoadedMetadata={(e) => {
                          const video = e.target as HTMLVideoElement;
                          video.currentTime = 1; // Show frame at 1 second
                        }}
                      />
                    )}
                    {/* Play icon overlay for videos */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center group-hover:bg-black/80 transition-colors">
                        <Play className="w-6 h-6 text-white ml-1" />
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 360° Badge */}
                {(post.type === 'image360' || post.type === 'video360') && (
                  <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
                    360°
                  </div>
                )}
                
                {/* VR Badge */}
                {post.type === 'vr' && (
                  <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
                    VR
                  </div>
                )}
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center bg-gray-200 overflow-hidden rounded-lg group">
                {/* Thumbnail or Logo background */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {post.thumbnailUrl ? (
                    <img
                      src={post.thumbnailUrl}
                      alt="Locked content thumbnail"
                      className="w-full h-full object-cover select-none"
                      draggable="false"
                    />
                  ) : (
                    <img
                      src="/images/LOGO only.png"
                      alt="Locked content logo"
                      className="w-[60px] h-[60px] opacity-30 select-none"
                      draggable="false"
                    />
                  )}
                </div>
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-400/80 via-gray-300/40 to-transparent" />
                {/* Lock icon */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
                  <div className="bg-gradient-to-br from-white/90 via-gray-100/80 to-fuchsia-100/60 rounded-full p-1.5 shadow-md mb-1 flex items-center justify-center border border-fuchsia-100">
                    <Lock size={20} strokeWidth={1.5} className="text-[#6437ff] drop-shadow-sm" />
                  </div>
                  <button
                    className="profile-btn subscribe text-xs px-3 py-1"
                    onClick={() => setShowPlansModal(true)}
                    disabled={plansLoading || plans.length === 0}
                  >
                    {plansLoading ? 'Loading...' : 'SUBSCRIBE'}
                  </button>
                </div>
                {/* Plans Modal for subscribing */}
                <PlansModal
                  open={showPlansModal}
                  onClose={() => setShowPlansModal(false)}
                  plans={plans}
                  creatorId={post.authorId}
                  onSelectPlan={() => setShowPlansModal(false)}
                />
              </div>
            )
          )
        ) : (
          <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-[#6437ff] rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    );
  }

  // Render live stream post if type is 'video' and streamId exists
  if (post.type === 'video' && post.streamId) {
    try {
      return (
        <LiveStreamPost
          streamId={post.streamId}
          title={post.title || ''}
          description={post.content}
          author={{
            id: post.author.id,
            displayName: post.author.displayName || 'Anonymous',
            photoURL: post.author.photoURL || undefined,
            username: post.author.username
          }}
          viewerCount={post.viewerCount || 0}
          createdAt={post.createdAt instanceof Date ? post.createdAt : post.createdAt?.toDate?.() || new Date()}
          thumbnailUrl={post.thumbnailUrl}
        />
      );
    } catch (err) {
      console.error('[LIVE_STREAM_POST_RENDER_ERROR]', err, post);
      return (
        <div style={{border: '2px solid red', padding: 16, background: '#fff0f0'}}>
          <strong>Live Stream Post Render Error</strong>
          <pre style={{fontSize: 12, whiteSpace: 'pre-wrap'}}>{JSON.stringify(post, null, 2)}</pre>
          <pre style={{fontSize: 12, color: 'red'}}>{String(err)}</pre>
        </div>
      );
    }
  }

  // Render gallery-only mode if showAsGalleryOnly is true
  if (showAsGalleryOnly) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {subChecked ? (
          post.mediaUrl && (
            canViewPost ? (
              <div className="relative w-full h-full">
                <MediaContent
                  url={post.mediaUrl}
                  type={post.type}
                  thumbnailUrl={post.thumbnailUrl}
                  compact={false}
                  username={post.author?.username}
                  showWatermark={post.showWatermark}
                />
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center bg-gray-200 overflow-hidden rounded-lg group">
                {/* Thumbnail or Logo background */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {post.thumbnailUrl ? (
                    <img
                      src={post.thumbnailUrl}
                      alt="Locked content thumbnail"
                      className="w-full h-full object-cover select-none"
                      draggable="false"
                    />
                  ) : (
                    <img
                      src="/images/LOGO only.png"
                      alt="Locked content logo"
                      className="w-[60px] h-[60px] opacity-30 select-none"
                      draggable="false"
                    />
                  )}
                </div>
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-400/80 via-gray-300/40 to-transparent" />
                {/* Lock icon */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
                  <div className="bg-gradient-to-br from-white/90 via-gray-100/80 to-fuchsia-100/60 rounded-full p-1.5 shadow-md mb-1 flex items-center justify-center border border-fuchsia-100">
                    <Lock size={20} strokeWidth={1.5} className="text-[#6437ff] drop-shadow-sm" />
                  </div>
                  <button
                    className="profile-btn subscribe text-xs px-3 py-1"
                    onClick={() => setShowPlansModal(true)}
                    disabled={plansLoading || plans.length === 0}
                  >
                    {plansLoading ? 'Loading...' : 'SUBSCRIBE'}
                  </button>
                </div>
                {/* Plans Modal for subscribing */}
                <PlansModal
                  open={showPlansModal}
                  onClose={() => setShowPlansModal(false)}
                  plans={plans}
                  creatorId={post.authorId}
                  onSelectPlan={() => setShowPlansModal(false)}
                />
              </div>
            )
          )
        ) : (
          <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-[#6437ff] rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    );
  }

  if (!currentPost?.author) return null;

  // Add a helper to render content with clickable @mentions and URLs
  function renderContentWithMentions(content: string) {
    // Regex patterns for mentions and URLs
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;
    
    const parts = [];
    let lastIndex = 0;
    
    // Find all matches (mentions and URLs)
    const allMatches = [];
    
    // Find mentions
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      allMatches.push({
        type: 'mention',
        start: match.index,
        end: mentionRegex.lastIndex,
        text: match[0],
        username: match[1]
      });
    }
    
    // Find URLs
    urlRegex.lastIndex = 0; // Reset regex
    while ((match = urlRegex.exec(content)) !== null) {
      allMatches.push({
        type: 'url',
        start: match.index,
        end: urlRegex.lastIndex,
        text: match[0],
        url: match[0].startsWith('http') ? match[0] : `https://${match[0]}`
      });
    }
    
    // Sort matches by position
    allMatches.sort((a, b) => a.start - b.start);
    
    // Render content with both mentions and URLs
    allMatches.forEach((match) => {
      if (match.start > lastIndex) {
        parts.push(content.slice(lastIndex, match.start));
      }
      
        if (match.type === 'mention') {
          parts.push(
            <a
              key={match.start}
              href={`/${match.username}`}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
              target="_blank"
              rel="noopener noreferrer"
            >
              @{match.username}
            </a>
          );
      } else if (match.type === 'url') {
        parts.push(
          <a
            key={match.start}
            href={match.url}
            className="text-blue-600 hover:underline cursor-pointer"
            target="_blank"
            rel="noopener noreferrer"
          >
            {match.text}
          </a>
        );
      }
      
      lastIndex = match.end;
    });
    
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }
    
    return parts;
  }

    return (
      <div className="relative w-full mb-4" style={{
        background: 'white',
        borderRadius: '17px 17px 27px 27px',
        boxShadow: '0px 187px 75px rgba(0, 0, 0, 0.01), 0px 105px 63px rgba(0, 0, 0, 0.05), 0px 47px 47px rgba(0, 0, 0, 0.09), 0px 12px 26px rgba(0, 0, 0, 0.1), 0px 0px 0px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Post Header - Profile and Time */}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <Link href={`/${currentPost.author?.username ? currentPost.author.username : 'profile/' + currentPost.authorId}`} className="shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarImage src={currentPost.author?.photoURL || ''} alt={currentPost.author?.displayName || 'User'} />
                <AvatarFallback className="text-xs">{currentPost.author?.displayName?.[0] || 'U'}</AvatarFallback>
              </Avatar>
            </Link>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/${currentPost.author?.username ? currentPost.author.username : 'profile/' + currentPost.authorId}`}
                  className="font-medium text-sm text-gray-900 hover:underline truncate"
                >
                  {currentPost.author.displayName || authorDisplayName}
                </Link>
                <span className="text-xs text-gray-500">
                  {currentPost.createdAt && formatDistanceToNow(
                    currentPost.createdAt instanceof Date 
                      ? currentPost.createdAt 
                      : currentPost.createdAt?.toDate?.() || new Date(),
                    { addSuffix: false }
                  )}
                </span>
              </div>
            </div>
          </div>
          
          {/* Post Options Menu */}
          <PostOptionsMenu
            postId={currentPost.id}
            authorId={currentPost.authorId}
            onEdit={handleEdit}
          />
        </div>

        {/* Post Text Content - Before Media */}
        {currentPost.content && (
          <div className="px-3 py-1.5">
            {isEditing ? (
              <motion.div 
                className="space-y-3"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full min-h-[120px] text-base leading-relaxed resize-none bg-white border-gray-200 focus:ring-brand-pink-main/20 focus:border-brand-pink-main/30 rounded-xl text-gray-900"
                  placeholder="What's on your mind?"
                  autoFocus
                />
                <motion.div 
                  className="flex justify-end gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="text-sm h-8 px-4 text-gray-900 bg-white hover:bg-gray-100 border-gray-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!editedContent.trim() || editedContent.trim() === currentPost.content?.trim()}
                    className="text-sm h-8 px-4 bg-black hover:bg-black/90 text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:bg-gray-300"
                  >
                    Save
                  </Button>
                </motion.div>
              </motion.div>
            ) : (
              <motion.p 
                className="text-base text-gray-900 leading-[1.6] whitespace-pre-wrap"
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {renderContentWithMentions(currentPost.content || '')}
              </motion.p>
            )}
          </div>
        )}

      {/* Post Media */}
      {subChecked ? (
        post.mediaUrl && (
          canViewPost ? (
            <motion.div className="relative bg-black/5">
              <MediaContent
                url={post.mediaUrl}
                type={post.type}
                thumbnailUrl={post.thumbnailUrl}
                hotspots={(post as any).vrSettings?.hotspots?.map((hotspot: any) => ({
                  position: typeof hotspot.position === 'object' 
                    ? `${hotspot.position.x} ${hotspot.position.y} ${hotspot.position.z}`
                    : String(hotspot.position),
                  text: String(hotspot.content || '')
                }))}
                compact={false}
                username={post.author?.username}
                showWatermark={(post as any).showWatermark !== false}
              />
            </motion.div>
          ) : (
            <div className="relative w-full aspect-video flex items-center justify-center bg-gray-200 overflow-hidden rounded-xl group">
              {/* Thumbnail or Logo background, object-contain for consistency */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {post.thumbnailUrl ? (
                  <img
                    src={post.thumbnailUrl}
                    alt="Locked content thumbnail"
                    className="w-full h-full object-contain select-none"
                    style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                    draggable="false"
                  />
                ) : (
                  <img
                    src="/images/LOGO only.png"
                    alt="Locked content logo"
                    className="w-[100px] h-[100px] opacity-30 select-none"
                    draggable="false"
                  />
                )}
              </div>
              {/* Gradient overlay for contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-gray-400/80 via-gray-300/40 to-transparent" />
              {/* Lock icon with circular background */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
                <div className="bg-gradient-to-br from-white/90 via-gray-100/80 to-fuchsia-100/60 rounded-full p-2 shadow-md mb-1 flex items-center justify-center border border-fuchsia-100">
                  <Lock size={26} strokeWidth={1.5} className="text-[#6437ff] drop-shadow-sm" />
                </div>
                <button
                  className="profile-btn subscribe"
                  onClick={() => setShowPlansModal(true)}
                  disabled={plansLoading || plans.length === 0}
                >
                  {plansLoading ? 'Loading...' : 'SUBSCRIBE'}
                </button>
              </div>
              {/* Plans Modal for subscribing */}
              <PlansModal
                open={showPlansModal}
                onClose={() => setShowPlansModal(false)}
                plans={plans}
                creatorId={post.authorId}
                onSelectPlan={() => setShowPlansModal(false)}
              />
              {/* Subtle hover effect */}
              <div className="absolute inset-0 rounded-xl ring-2 ring-fuchsia-400/30 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none" />
            </div>
          )
        )
      ) : null}

      {/* Post Tags */}
      {post.tags && post.tags.length > 0 && (
        <motion.div 
          className="px-5 py-2.5 flex flex-wrap gap-1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {post.tags.slice(0, 3).map((tag: string, index: number) => (
            <motion.div
              key={tag}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Badge 
                variant="secondary" 
                className="text-[12px] px-2.5 py-0.5 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium cursor-pointer"
              >
                #{tag}
              </Badge>
            </motion.div>
          ))}
          {post.tags.length > 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Badge 
                variant="secondary" 
                className="text-[12px] px-2.5 py-0.5 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium cursor-pointer"
              >
                +{post.tags.length - 3}
              </Badge>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Post Actions */}
      <motion.div 
        className="px-4 py-2 flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50"
        whileHover={{ backgroundColor: 'rgba(0,0,0,0.01)' }}
      >
        {/* Like button - Left side (moved from right) */}
        <div className="flex items-center gap-2">
          {/* Views counter, only for post author */}
          {user?.uid === currentPost.authorId && (currentPost as any)?.engagement && (
            <div className="flex items-center gap-1.5 text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span className="text-xs font-medium">{(currentPost as any)?.engagement?.views || 0}</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-0">
            <HeartButton
              isLiked={isLiked}
              onToggle={() => {
                if (!canInteract) {
                  toast.error('Subscribe to interact with this content');
                  return;
                }
                console.log('HeartButton onToggle called!');
                handleLike();
              }}
              likesCount={currentPost.likes || 0}
              className="scale-50"
              disabled={!canInteract}
            />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 min-w-[16px] text-center -mt-2">
              {currentPost.likes || 0}
            </span>
          </div>
        </div>

        {/* Comment button - Right side */}
        <div className="flex items-center gap-2">
          <CommentButton
            onClick={() => {
              if (!canInteract) {
                toast.error('Subscribe to comment on this content');
                return;
              }
              handleComment();
            }}
            comments={commentCount}
            postId={currentPost.id}
            disabled={!canInteract}
          />
        </div>
      </motion.div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-700/20 overflow-hidden"
          >
            {/* Comments List */}
            <div className="px-5 py-3">
              <Comments
                postId={currentPost.id}
                postAuthorId={currentPost.authorId}
                currentUserId={currentUserId}
                commentId={commentId}
                highlight={highlight}
                onCommentAdded={handleCommentAdded}
                sortBy={sortBy}
                onSortChange={setSortBy}
                post={currentPost}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialogs */}
      <PostDetailsDialog
        post={currentPost}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
      />
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
} 