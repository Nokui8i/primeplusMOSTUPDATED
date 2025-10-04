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

  const canReply = currentUserId && currentUserId !== author.id;

  // Check if content is a command
  const isCommand = (content: string) => {
    return content.trim().startsWith('$') || content.trim().startsWith('>');
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
                <AvatarFallback className="text-xs">{author.displayName[0]}</AvatarFallback>
              </Avatar>
            </Link>
          </div>
          <div className="user-info">
            <span>{author.displayName}</span>
            <p>{createdAt ? formatDistanceToNow(createdAt.toDate(), { addSuffix: true }) : 'just now'}</p>
          </div>
        </div>
        <div className="comment-content">
          {renderContentWithMentions(initialContent)}
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
        onConfirm={() => {
          setIsDeleting(true);
          // Add delete logic here
          setShowDeleteDialog(false);
          setIsDeleting(false);
        }}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}