import { useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { doc, getDoc, collection, addDoc, serverTimestamp, writeBatch, increment, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { toast } from 'react-hot-toast'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { createNotification } from '@/lib/notifications'
import { isCommand } from '@/lib/utils'
import { UserTagInput } from '@/components/ui/user-tag-input'
import { query, where, getDocs } from 'firebase/firestore'
import { createComment } from '@/lib/firebase/db'

interface CommentInputProps {
  postId: string
  postAuthorId: string
  onCommentAdded?: () => void
  parentId?: string
}

export function CommentInput({ postId, postAuthorId, onCommentAdded, parentId }: CommentInputProps) {
  const { user } = useAuth()
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [taggedUsers, setTaggedUsers] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const inputRef = useRef<HTMLInputElement>(null)

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

    setIsSubmitting(true)

    try {
      // Use the unified createComment function
      const commentId = await createComment(postId, comment, user, parentId || undefined)
      // Send notifications to tagged users
      for (const taggedUserId of taggedUsers) {
        if (taggedUserId !== user.uid) {
          await createNotification({
            type: 'comment',
            fromUser: {
              uid: user.uid,
              displayName: user.displayName || 'Anonymous',
              photoURL: user.photoURL || ''
            },
            toUser: taggedUserId,
            data: {
              postId,
              commentId,
              text: comment.trim().length > 100 ? comment.trim().substring(0, 100) + '...' : comment.trim(),
              isCommand: isCommand(comment.trim()),
              timestamp: Timestamp.now()
            }
          });
        }
      }
      setComment('')
      toast.success('Comment added successfully')
      if (onCommentAdded) {
        onCommentAdded()
      }
    } catch (error) {
      console.error('[CommentInput] Error adding comment:', error)
      toast.error('Failed to add comment. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper to check if a user allows tagging
  const canTagUser = async (userId: string) => {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return false;
    const privacy = userDoc.data().privacy || {};
    return privacy.allowTagging !== false;
  };

  // Filter tagged users based on their privacy setting
  const handleTaggedUsersChange = async (users: string[]) => {
    const allowed = [];
    for (const userId of users) {
      if (await canTagUser(userId)) allowed.push(userId);
    }
    setTaggedUsers(allowed);
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
            const lineHeight = parseInt(window.getComputedStyle(input).lineHeight);
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
    if (!taggedUsers.includes(selectedUser.id)) {
      setTaggedUsers([...taggedUsers, selectedUser.id]);
    }
    if (inputRef.current) {
      const newCursorPos = beforeCursor.length + selectedUser.username.length + 2;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }
  };

  return (
    <div className="flex items-start gap-3 mb-4">
      <Avatar className="h-8 w-8 rounded-full">
        <AvatarImage src={user?.photoURL || '/default-avatar.png'} alt="Your avatar" />
        <AvatarFallback>{user?.displayName?.[0] || 'U'}</AvatarFallback>
      </Avatar>
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-2 relative">
          <input
            ref={inputRef}
            type="text"
            value={comment}
            onChange={handleInputChange}
            placeholder={isCommand(comment) ? "Enter command..." : "Add a comment..."}
            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700/50 rounded-full text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-pink-main dark:focus:ring-brand-pink-light"
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
          <button
            type="submit"
            disabled={!comment.trim() || isSubmitting}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-full text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Post
          </button>
        </div>
        {/* <UserTagInput taggedUsers={taggedUsers} onTaggedUsersChange={handleTaggedUsersChange} /> */}
      </form>
    </div>
  )
} 