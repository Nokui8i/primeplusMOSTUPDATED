import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { doc, getDoc, collection, addDoc, serverTimestamp, writeBatch, increment, Timestamp, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { toast } from 'react-hot-toast'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { createNotification } from '@/lib/firebase/db'
import { isCommand } from '@/lib/utils'
import { UserTagInput } from '@/components/ui/user-tag-input'
import { createComment } from '@/lib/firebase/db'

interface CommentInputProps {
  postId: string
  postAuthorId: string
  onCommentAdded?: () => void
  parentId?: string
  post?: any // Add post prop to check access level
}

export function CommentInput({ postId, postAuthorId, onCommentAdded, parentId, post }: CommentInputProps) {
  const { user } = useAuth()
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [taggedUsers, setTaggedUsers] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [isCommentingDisabled, setIsCommentingDisabled] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Check commenting permissions when component mounts or post changes
  useEffect(() => {
    const checkCommentingPermissions = async () => {
      if (user && post) {
        const canUserComment = await canComment();
        setIsCommentingDisabled(!canUserComment);
      }
    };
    checkCommentingPermissions();
  }, [user, post]);

  // Check if user can comment on this post
  const canComment = async () => {
    if (!user || !post) return true; // Allow if no post data or user
    
    // Always allow the creator to comment on their own post
    if (user.uid === post.authorId) return true;
    
    // Check if comments are disabled for this specific post
    if (post.allowComments === false) {
      return false;
    }
    
    // If post has allowComments set to true, allow commenting
    if (post.allowComments === true) {
      return true;
    }
    
    // If allowComments is null (use global setting), check user's privacy settings
    if (post.allowComments === null || post.allowComments === undefined) {
      // Check if there's a specific comment access level
      if (post.commentAccessLevel === 'subscribers') {
        // Check if user is a subscriber (free or paid)
        try {
          const subscriptionDoc = await getDoc(doc(db, 'subscriptions', `${user.uid}_${post.authorId}`));
          if (!subscriptionDoc.exists()) {
            return false; // Not subscribed
          }
        } catch (error) {
          console.error('Error checking subscription:', error);
          return false;
        }
      } else if (post.commentAccessLevel === 'paid_subscribers') {
        // Check if user is a paid subscriber
        try {
          const subscriptionDoc = await getDoc(doc(db, 'subscriptions', `${user.uid}_${post.authorId}`));
          if (!subscriptionDoc.exists()) {
            return false; // Not subscribed
          }
          const subscriptionData = subscriptionDoc.data();
          if (subscriptionData?.tier !== 'paid') {
            return false; // Not a paid subscriber
          }
        } catch (error) {
          console.error('Error checking paid subscription:', error);
          return false;
        }
      } else {
        // Use global setting
        try {
          const postAuthorDoc = await getDoc(doc(db, 'users', post.authorId));
          if (postAuthorDoc.exists()) {
            const postAuthorData = postAuthorDoc.data();
            const globalAllowComments = postAuthorData.privacy?.allowComments;
            
            // If global setting is false, deny commenting
            if (globalAllowComments === false) {
              return false;
            }
            
            // If global setting is true or undefined, continue with access level checks
          }
        } catch (error) {
          console.error('Error checking global comment settings:', error);
          // If we can't check global settings, continue with access level checks
        }
      }
    }
    
    // If post is public, allow everyone to comment
    if (post.isPublic) return true;
    
    // Check access level
    const accessLevel = post.accessSettings?.accessLevel;
    
    // If no access level or free content, allow commenting
    if (!accessLevel || accessLevel === 'free') return true;
    
    // For locked content, check subscription status
    if (accessLevel === 'free_subscriber' || accessLevel === 'followers' || 
        accessLevel === 'paid_subscriber' || accessLevel === 'premium' || 
        accessLevel === 'exclusive') {
      
      try {
        // Check subscription in Firebase
        const q = query(
          collection(db, 'subscriptions'),
          where('subscriberId', '==', user.uid),
          where('creatorId', '==', post.authorId),
          where('status', 'in', ['active', 'cancelled'])
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const now = new Date();
          const hasValidSubscription = querySnapshot.docs.some(doc => {
            const data = doc.data();
            const isActive = data.status === 'active';
            const isCancelledButValid = data.status === 'cancelled' && 
              data.endDate && 
              data.endDate.toDate() > now;
            return isActive || isCancelledButValid;
          });
          
          if (hasValidSubscription) return true;
        }
        
        // If no valid subscription found, user cannot comment
        return false;
      } catch (error) {
        console.error('Error checking subscription for commenting:', error);
        return false;
      }
    }
    
    return false;
  };

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

    // Check if user can comment on this post
    const userCanComment = await canComment();
    if (!userCanComment) {
      // Show specific error message based on comment access level
      if (post?.commentAccessLevel === 'subscribers') {
        toast.error('You need to subscribe to this creator to comment')
      } else if (post?.commentAccessLevel === 'paid_subscribers') {
        toast.error('You need to be a paid subscriber to comment')
      } else if (post?.allowComments === false) {
        toast.error('Comments are disabled for this post')
      } else {
        toast.error('You need to subscribe to this creator to comment on their locked content')
      }
      return
    }

    setIsSubmitting(true)

    try {
      // Use the unified createComment function
      const commentId = await createComment(postId, comment, user, parentId || undefined)
      // Send notifications to tagged users (mentions)
      for (const taggedUserId of taggedUsers) {
        if (taggedUserId !== user.uid) {
          await createNotification({
            type: 'mention',
            fromUser: {
              uid: user.uid,
              displayName: user.displayName || 'Anonymous',
              photoURL: user.photoURL || '',
              username: user.displayName || 'Anonymous'
            },
            toUser: taggedUserId,
            data: {
              postId,
              commentId,
              text: comment.trim().length > 100 ? comment.trim().substring(0, 100) + '...' : comment.trim(),
              isCommand: isCommand(comment.trim()),
              timestamp: serverTimestamp()
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

  const handleInputChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
    <div className="text-box">
      <div className="box-container">
        <form onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            value={comment}
            onChange={handleInputChange}
            placeholder={isCommentingDisabled ? "Subscribe to comment on locked content" : "Reply"}
            disabled={isCommentingDisabled}
            style={{
              width: '100%',
              height: '32px',
              resize: 'none',
              border: '0',
              borderRadius: '0',
              padding: '8px 12px',
              fontSize: '14px',
              outline: 'none',
              caretColor: isCommentingDisabled ? '#ccc' : '#0a84ff',
              background: 'transparent',
              color: isCommentingDisabled ? '#999' : 'inherit',
              fontFamily: 'inherit',
              lineHeight: 'normal',
              boxShadow: 'none'
            }}
          />
          {showResults && searchResults.length > 0 && (
            <div
              className="user-dropdown"
              style={{
                position: 'absolute',
                zIndex: 10,
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                padding: '0',
                minWidth: '120px',
                maxWidth: '220px',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                transform: 'translateY(-50%)'
              }}
            >
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  className="user-dropdown-item"
                  onClick={() => handleUserSelect(result)}
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <Avatar className="w-5 h-5 mr-1">
                    <AvatarImage src={result.photoURL} />
                    <AvatarFallback>{result.username?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <span style={{ color: 'black', fontSize: '12px' }}>{result.username}</span>
                </button>
              ))}
            </div>
          )}
          <div className="formatting">
            <button type="button" className="formatting-btn">
              <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M5 6C5 4.58579 5 3.87868 5.43934 3.43934C5.87868 3 6.58579 3 8 3H12.5789C15.0206 3 17 5.01472 17 7.5C17 9.98528 15.0206 12 12.5789 12H5V6Z" clipRule="evenodd" fillRule="evenodd"></path>
                <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M12.4286 12H13.6667C16.0599 12 18 14.0147 18 16.5C18 18.9853 16.0599 21 13.6667 21H8C6.58579 21 5.87868 21 5.43934 20.5607C5 20.1213 5 19.4142 5 18V12"></path>
              </svg>
            </button>
            <button type="button" className="formatting-btn">
              <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M12 4H19"></path>
                <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M8 20L16 4"></path>
                <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M5 20H12"></path>
              </svg>
            </button>
            <button type="button" className="formatting-btn">
              <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M5.5 3V11.5C5.5 15.0899 8.41015 18 12 18C15.5899 18 18.5 15.0899 18.5 11.5V3"></path>
                <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M3 21H21"></path>
              </svg>
            </button>
            <button type="button" className="formatting-btn">
              <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M4 12H20"></path>
                <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M17.5 7.66667C17.5 5.08934 15.0376 3 12 3C8.96243 3 6.5 5.08934 6.5 7.66667C6.5 8.15279 6.55336 8.59783 6.6668 9M6 16.3333C6 18.9107 8.68629 21 12 21C15.3137 21 18 19.6667 18 16.3333C18 13.9404 16.9693 12.5782 14.9079 12"></path>
              </svg>
            </button>
            <button type="button" className="formatting-btn">
              <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                <circle strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#707277" r="10" cy="12" cx="12"></circle>
                <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M8 15C8.91212 16.2144 10.3643 17 12 17C13.6357 17 15.0879 16.2144 16 15"></path>
                <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="3" stroke="#707277" d="M8.00897 9L8 9M16 9L15.991 9"></path>
              </svg>
            </button>
            <button type="submit" className="send" title="Send" disabled={!comment.trim() || isSubmitting || isCommentingDisabled}>
              <svg fill="none" viewBox="0 0 24 24" height="18" width="18" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#ffffff" d="M12 5L12 20"></path>
                <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#ffffff" d="M7 9L11.2929 4.70711C11.6262 4.37377 11.7929 4.20711 12 4.20711C12.2071 4.20711 12.3738 4.37377 12.7071 4.70711L17 9"></path>
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 