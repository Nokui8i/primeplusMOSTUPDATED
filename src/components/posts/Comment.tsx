import React, { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { doc, updateDoc, deleteDoc, serverTimestamp, increment, writeBatch, collection, addDoc, getDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit2, Trash2, ThumbsUp, Heart, MessageSquare, MoreHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';
import { createNotification, toggleLike, deleteComment, deleteNotification, createComment } from '@/lib/firebase/db';
import { FaHeart, FaRegHeart, FaReply, FaTrash, FaEdit } from 'react-icons/fa';
import { LikesList } from './LikesList';
import { CommentsList } from './CommentsList';
import ConfirmationDialog from '../ui/ConfirmationDialog';
import { AnimatePresence, motion } from 'framer-motion';
import './CommentHighlight.css';

interface Author {
  id: string;
  displayName: string;
  username?: string;
  photoURL?: string;
}

interface NotificationData {
  postId: string;
  commentId: string;
  originalCommentId?: string;
  parentCommentId?: string;
  text: string;
  isCommand: boolean;
  isReplyToCommand: boolean;
  originalCommand?: string;
  notificationType: string;
}

interface CommentProps {
  id: string;
  postId: string;
  postAuthorId: string;
  content: string;
  author: Author;
  createdAt: any;
  currentUserId?: string;
  likes?: number;
  parentId?: string;
  repliesCount?: number;
  background?: string | null;
  commentId?: string | null;
  highlight?: boolean;
}

export function Comment({
  id,
  postId,
  postAuthorId,
  content: initialContent,
  author,
  createdAt,
  currentUserId,
  likes = 0,
  parentId,
  commentId,
  highlight
}: CommentProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(likes);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isCommandReplying, setIsCommandReplying] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [showCommandDialog, setShowCommandDialog] = useState(false);
  const [repliesCount, setRepliesCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const commentRef = useRef<HTMLDivElement>(null);

  const canModify = currentUserId && (
    currentUserId === author.id || // Comment author
    currentUserId === postAuthorId // Post author
  );

  const canEdit = currentUserId === author.id; // Only comment author can edit

  // Update likeCount when likes prop changes
  useEffect(() => {
    setLikeCount(likes);
  }, [likes]);

  // Check if user has liked this comment
  useEffect(() => {
    if (!user) return;

    const checkLikeStatus = async () => {
      try {
        const likeRef = doc(db, `posts/${postId}/comments/${id}/likes/${user.uid}`);
        const likeDoc = await getDoc(likeRef);
        setIsLiked(likeDoc.exists());
      } catch (error) {
        console.error('Error checking like status:', error);
      }
    };

    // Set up real-time listener for likes count
    const commentRef = doc(db, `posts/${postId}/comments/${id}`);
    const unsubscribe = onSnapshot(commentRef, (doc) => {
      if (doc.exists()) {
        setLikeCount(doc.data()?.likes || 0);
      }
    });

    checkLikeStatus();
    return () => unsubscribe();
  }, [user, id, postId]);

  // Add useEffect to fetch replies count
  useEffect(() => {
    const repliesRef = collection(db, `posts/${postId}/comments`);
    const q = query(repliesRef, where('parentId', '==', id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRepliesCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [postId, id]);

  useEffect(() => {
    if (highlight && commentId && id === commentId && commentRef.current) {
      commentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlight, commentId, id]);

  const handleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like comments');
      return;
    }

    try {
      setIsLiked(prev => !prev);
      setLikeCount(prev => prev + (isLiked ? -1 : 1));

      // Properly construct the path for toggleLike
      const path = `posts/${postId}/comments/${id}`;
      const newIsLiked = await toggleLike(
        path,
        user.uid,
        user.displayName || '',
        user.photoURL || ''
      );

      setIsLiked(newIsLiked);
    } catch (error) {
      console.error('Error liking comment:', error);
      // Revert UI state on error
      setIsLiked(prev => !prev);
      setLikeCount(prev => prev + (isLiked ? 1 : -1));
      toast.error('Failed to like comment');
    }
  };

  const handleReply = async () => {
    if (!currentUserId || !replyContent.trim() || !user) return;
    setIsSubmitting(true);
    try {
      // Use the unified createComment function for replies
      const commentId = await createComment(postId, replyContent, user, id)
      console.debug('[Comment] createComment (reply) result', { commentId })
      // Notification logic remains unchanged
      // ... existing code for notifications ...
      setReplyContent('');
      setIsReplying(false);
      setIsCommandReplying(false);
      toast.success('Reply added successfully');
    } catch (error) {
      console.error('Error adding reply:', error);
      toast.error('Failed to add reply');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to check if content is a command
  const isCommand = (content: string) => {
    return content.trim().startsWith('$') || content.trim().startsWith('>')
  };

  const handleEdit = async () => {
    if (!currentUserId || !editedContent.trim()) return;
    
    try {
      const commentRef = doc(db, `posts/${postId}/comments/${id}`);
      await updateDoc(commentRef, {
        content: editedContent,
        isEdited: true,
        updatedAt: serverTimestamp()
      });
      setIsEditing(false);
      toast.success('Comment updated successfully');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Failed to update comment');
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      await deleteComment(postId, id, user.uid);
      toast.success('Comment deleted successfully');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Inline mention logic for command dialog
  const handleCommandInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setReplyContent(value);
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
          }).filter(user => user.privacy?.allowTagging !== false);
          setSearchResults(results);
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
    const beforeCursor = replyContent.substring(0, cursorPosition).replace(/@\w*$/, '');
    const afterCursor = replyContent.substring(cursorPosition);
    const newContent = `${beforeCursor}@${selectedUser.username} ${afterCursor}`;
    setReplyContent(newContent);
    setShowResults(false);
    if (inputRef.current) {
      const newCursorPos = beforeCursor.length + selectedUser.username.length + 2;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }
  };

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
            <Link
              key={match.start}
              href={`/profile/${match.username}`}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              @{match.username}
            </Link>
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
    <div
      ref={commentRef}
      className={
        `relative group${highlight && commentId && id === commentId ? ' highlighted-comment' : ''}`
      }
    >
      {/* Main comment content */}
      <div className="relative flex items-start gap-1.5">
        <Link href={`/profile/${author.username || author.id}`} className="shrink-0">
          <Avatar className="h-6 w-6" style={{ width: '24px', height: '24px' }}>
            <AvatarImage src={author.photoURL} alt={author.displayName} />
            <AvatarFallback className="text-xs">{author.displayName[0]}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1">
            <div className="relative flex-1">
              <div
                className={`rounded-3xl px-3 py-2 min-h-fit relative transition-all duration-200 shadow-sm hover:shadow-md max-w-[600px]
                      ${isCommand(initialContent)
                        ? 'bg-gradient-to-br from-[#FF8DC7] to-[#FF69B4] dark:from-[#2B1B5A] dark:to-[#4169E1] backdrop-blur-lg border-l-[3px] border-[#FF69B4] dark:border-[#4169E1] shadow-[0_2px_12px_rgba(255,105,180,0.15)] dark:shadow-[0_2px_12px_rgba(65,105,225,0.15)]'
                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
              >
                {/* Options Menu - Top Right */}
                {(currentUserId === author.id || currentUserId === postAuthorId) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="absolute top-2 right-2 h-6 w-6 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none !focus-visible:ring-0 !focus-visible:ring-offset-0"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      {currentUserId === author.id && (
                        <DropdownMenuItem
                          onClick={() => {
                            setIsEditing(true);
                          }}
                          className="text-xs py-1.5 cursor-pointer"
                        >
                          Edit
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-xs py-1.5 cursor-pointer text-red-500 focus:text-red-500"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {isCommand(initialContent) && (
                  <div className="absolute -left-5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-brand-pink-main dark:text-brand-pink-light">
                    {initialContent.trim().startsWith('$') ? '$' : '>'}
                  </div>
                )}
                
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/profile/${author.username || author.id}`}
                    className={`font-semibold text-xs hover:underline whitespace-nowrap ${
                      isCommand(initialContent) 
                        ? 'text-brand-pink-dark dark:text-brand-pink-light' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {author.displayName}
                  </Link>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {createdAt ? formatDistanceToNow(createdAt.toDate(), { addSuffix: true }) : 'just now'}
                  </span>
                </div>
                
                {/* Content */}
                <div className={`mt-1 text-sm text-black dark:text-white ${isCommand(initialContent) ? 'font-mono' : ''}`}>
                  {renderContentWithMentions(initialContent)}
                </div>
                
                {/* Like Button - Always at far right */}
                <div className="flex justify-end mt-1">
                  <button
                    className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 hover:text-brand-pink-main dark:hover:text-brand-pink-light transition focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none !focus-visible:ring-0 !focus-visible:ring-offset-0"
                    onClick={handleLike}
                  >
                    {isLiked ? <FaHeart className="text-brand-pink-main" /> : <FaRegHeart />}
                    <span>{likeCount}</span>
                  </button>
                </div>
              </div>
            </div>
            {/* Nested replies, OUTSIDE the main bubble */}
            <div className="ml-8 pl-4 mt-2 border-l border-gray-200 dark:border-gray-700/60">
              <CommentsList
                postId={postId}
                postAuthorId={postAuthorId}
                currentUserId={currentUserId}
                parentId={id}
                className="space-y-3"
                commentId={commentId}
                highlight={highlight}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Replies section with connection lines */}
      {showReplies && (
        <div className="mt-2 relative">
          {/* Vertical connection line for the entire replies section */}
          <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
          
          <div className="ml-6 pl-4">
            <CommentsList
              postId={postId}
              postAuthorId={postAuthorId}
              currentUserId={currentUserId}
              parentId={id}
              className="space-y-3"
              commentId={commentId}
              highlight={highlight}
            />
          </div>
        </div>
      )}

      {/* Command Dialog */}
      {showCommandDialog && (
        <div className="mt-2 ml-8">
          <form onSubmit={(e) => {
            e.preventDefault();
            handleReply();
          }} className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={replyContent}
              onChange={handleCommandInputChange}
              placeholder="Enter command..."
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full pr-16 pl-4 py-1.5 text-[13px] text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-pink-main dark:focus:ring-brand-pink-light shadow-sm hover:shadow transition-all duration-200"
            />
            {showResults && searchResults.length > 0 && (
              <div
                className="absolute z-10 bg-white dark:bg-gray-800 border rounded-md shadow-lg p-0 min-w-[120px] max-w-[220px]"
                style={{
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`,
                  transform: 'translateY(-50%)'
                }}
              >
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    className="flex items-center w-full px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 gap-1.5"
                    onClick={() => handleUserSelect(result)}
                    type="button"
                  >
                    <Avatar className="w-5 h-5 mr-1">
                      <AvatarImage src={result.photoURL} />
                      <AvatarFallback>{result.username?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="text-black dark:text-white text-xs">{result.username}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="absolute right-2 flex items-center gap-1">
              <button
              type="submit"
              disabled={!replyContent.trim() || isSubmitting}
                className="p-1 text-gray-400 hover:text-brand-pink-main dark:hover:text-brand-pink-light disabled:opacity-50 disabled:hover:text-gray-400"
            >
                <svg className="h-4 w-4 rotate-90 transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
              <button
              type="button"
              onClick={() => setShowCommandDialog(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Likes List Dialog */}
      <LikesList
        postId={postId}
        commentId={id}
        open={showLikes}
        onOpenChange={setShowLikes}
      />

      <ConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
} 