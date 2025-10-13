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
import { toggleLike, deleteComment, createComment } from '@/lib/firebase/db';
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const commentRef = useRef<HTMLDivElement>(null);

  const canModify = currentUserId && (
    currentUserId === author.id || // Comment author
    currentUserId === postAuthorId // Post author
  );

  const canReply = currentUserId && currentUserId !== author.id;

  // Check if content is a command
  const isCommand = (content: string) => {
    return content.trim().startsWith('$') || content.trim().startsWith('>');
  };

  // Check if comment is longer than 3 lines
  const isLongComment = (content: string) => {
    // Check if content would wrap to more than 3 lines
    // Split by words and estimate line count based on typical line width
    const words = content.split(' ');
    const estimatedCharsPerLine = 50; // Rough estimate for mobile/desktop
    const estimatedLines = Math.ceil(content.length / estimatedCharsPerLine);
    return estimatedLines > 3 || content.length > 120;
  };

  // Get truncated content for display
  const getDisplayContent = (content: string) => {
    if (!isLongComment(content) || isExpanded) {
      return content;
    }
    // Truncate to approximately 3 lines (120 characters)
    return content.length > 120 ? content.substring(0, 120) + '...' : content;
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
      <div className="comment-container relative pb-4 mb-4 border-b border-gray-200 last:border-b-0 last:mb-0">
        <div className="user">
          <div className="user-pic">
            <Link href={`/profile/${author.username || author.id}`}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={author.photoURL} alt={author.displayName} />
                <AvatarFallback className="text-xs">{author.displayName?.[0]?.toUpperCase() || '?'}</AvatarFallback>
              </Avatar>
            </Link>
          </div>
          <div className="user-info">
            <span>{author.displayName}</span>
            <p>{createdAt ? formatDistanceToNow(createdAt.toDate(), { addSuffix: true }) : 'just now'}</p>
          </div>
          {/* 3 dots menu for edit/delete */}
          {canModify && (
            <div className="ml-auto">
              <DropdownMenu modal={false} onOpenChange={setIsMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`h-8 w-8 p-0 opacity-100 transition-colors ${
                      isMenuOpen 
                        ? 'text-blue-600' 
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="start" 
                  className="w-32 bg-white border border-gray-200 shadow-lg mt-3 -ml-8 z-50" 
                  sideOffset={-15}
                  avoidCollisions={false}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                  style={{ 
                    pointerEvents: 'auto',
                    zIndex: 99999,
                    position: 'fixed'
                  }}
                >
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🔍 Comment Edit clicked!');
                      setIsEditing(true);
                    }}
                    className="text-xs py-1.5 cursor-pointer bg-white hover:bg-gray-50"
                    style={{
                      pointerEvents: 'auto',
                      cursor: 'pointer',
                      zIndex: 99999,
                      position: 'relative'
                    }}
                  >
                    <Edit2 className="h-3 w-3 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🔍 Comment Delete clicked!');
                      setShowDeleteDialog(true);
                    }}
                    className="text-xs py-1.5 cursor-pointer text-red-600 bg-white hover:bg-red-50"
                    style={{
                      pointerEvents: 'auto',
                      cursor: 'pointer',
                      zIndex: 99999,
                      position: 'relative'
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        <div className="comment-content">
          {isEditing ? (
            <div className="mt-2 comment-edit-container">
              <div className="comment-edit-input-wrapper">
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="comment-edit-textarea"
                  placeholder="Edit your comment..."
                  rows={3}
                />
              </div>
              <div className="comment-edit-buttons">
                <button
                  onClick={async () => {
                    if (!editedContent.trim()) return;
                    setIsSubmitting(true);
                    try {
                      await updateDoc(doc(db, 'comments', id), {
                        content: editedContent.trim(),
                        updatedAt: serverTimestamp()
                      });
                      setIsEditing(false);
                      toast.success('Comment updated');
                    } catch (error) {
                      console.error('Error updating comment:', error);
                      toast.error('Failed to update comment');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={!editedContent.trim() || isSubmitting}
                  className="comment-edit-save-btn"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedContent(initialContent);
                  }}
                  className="comment-edit-cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="comment-text">
              <div className="whitespace-pre-wrap break-words">
                {renderContentWithMentions(getDisplayContent(initialContent))}
              </div>
              {isLongComment(initialContent) && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-1 transition-colors"
                >
                  {isExpanded ? 'Show less' : 'Read all'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Replies section */}
      {showReplies && (
        <div className="mt-2 relative">
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

      {/* Delete confirmation dialog */}
      <ConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={async () => {
          setIsDeleting(true);
          try {
            await deleteComment(postId, id);
            toast.success('Comment deleted');
            setShowDeleteDialog(false);
          } catch (error) {
            console.error('Error deleting comment:', error);
            toast.error('Failed to delete comment');
          } finally {
            setIsDeleting(false);
          }
        }}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}