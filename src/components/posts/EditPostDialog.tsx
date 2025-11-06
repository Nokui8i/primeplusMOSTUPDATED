import { useState, useEffect, useRef } from 'react'
import { Post as PostType } from '@/lib/types/post'
import { Button } from '@/components/ui/button'
import { updatePost, createNotification } from '@/lib/firebase/db'
import { toast } from 'react-hot-toast'
import MediaContent from '@/components/posts/MediaContent'
import { useAuth } from '@/lib/firebase/auth'
import { X, Smile, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ContentWatermark } from '@/components/media/ContentWatermark'
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createPortal } from 'react-dom'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

interface EditPostDialogProps {
  post: PostType
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditPostDialog({
  post,
  open,
  onOpenChange,
}: EditPostDialogProps) {
  const { user } = useAuth()
  const [content, setContent] = useState(post.content || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const contentEditableRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [taggedUsers, setTaggedUsers] = useState<string[]>(post.taggedUsers || [])
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [accessLevel, setAccessLevel] = useState<'free' | 'free_subscriber' | 'paid_subscriber' | 'ppv'>(() => {
    const level = post.accessSettings?.accessLevel || 'free';
    // Map old values to new values
    if (level === 'followers' || level === 'premium' || level === 'exclusive') {
      return 'free_subscriber';
    }
    return level as 'free' | 'free_subscriber' | 'paid_subscriber' | 'ppv';
  });
  const [allowComments, setAllowComments] = useState<'everyone' | 'subscribers' | 'paid_subscribers' | 'none'>(() => {
    if (post.allowComments === false) return 'none';
    if (post.allowComments === true) return 'everyone';
    if (post.commentAccessLevel === 'subscribers') return 'subscribers';
    if (post.commentAccessLevel === 'paid_subscribers') return 'paid_subscribers';
    return 'everyone';
  })
  const [ppvPrice, setPpvPrice] = useState<number>(post.accessSettings?.ppvPrice || 0)
  const [ppvEveryonePays, setPpvEveryonePays] = useState<boolean>(post.accessSettings?.ppvEveryonePays ?? true)
  const [showWatermark, setShowWatermark] = useState<boolean>(post.showWatermark ?? false)
  const [isVerified, setIsVerified] = useState(false)
  const [isCreatorRole, setIsCreatorRole] = useState(false)
  const [is360Mode, setIs360Mode] = useState<boolean>(post.type === 'video360' || post.type === 'image360')
  const [userProfile, setUserProfile] = useState<any>(null)
  // Store the initial 360 mode state for comparison
  const initialIs360Mode = post.type === 'video360' || post.type === 'image360'

  // Helper to get all text nodes from an element
  const getTextNodes = (node: Node): Text[] => {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      node,
      NodeFilter.SHOW_TEXT,
      null
    );
    let current;
    while (current = walker.nextNode()) {
      textNodes.push(current as Text);
    }
    return textNodes;
  };
  
  // Format content with blue mentions
  const formatContentWithMentions = (text: string): string => {
    if (!text) return '';
    const escapeHtml = (str: string) => {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };
    
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    let lastIndex = 0;
    const parts: string[] = [];
    
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(escapeHtml(text.substring(lastIndex, match.index)));
      }
      parts.push(`<span style="color: #2563eb; font-weight: 600;">${escapeHtml(match[0])}</span>`);
      lastIndex = mentionRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(escapeHtml(text.substring(lastIndex)));
    }
    
    return parts.join('') || '<br>';
  };

  // Handle contentEditable input
  const handleContentEditableInput = async (e: React.FormEvent<HTMLDivElement>) => {
    console.log('[EditPostDialog] handleContentEditableInput called');
    const target = e.currentTarget;
    const text = target.innerText || target.textContent || '';
    console.log('[EditPostDialog] Content text:', text);
    setContent(text);
    
    const selection = window.getSelection();
    let cursorPos = 0;
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(target);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      cursorPos = preCaretRange.toString().length;
    }
    setCursorPosition(cursorPos);
    
    const formattedHtml = formatContentWithMentions(text);
    const savedCursorPos = cursorPos;
    
    requestAnimationFrame(() => {
      if (contentEditableRef.current) {
        const wasEmpty = !contentEditableRef.current.innerText;
        contentEditableRef.current.innerHTML = formattedHtml || '<br>';
        
        if (selection) {
          try {
            const textNodes = getTextNodes(contentEditableRef.current);
            let charCount = 0;
            let found = false;
            
            for (const node of textNodes) {
              const nodeLength = node.textContent?.length || 0;
              if (charCount + nodeLength >= savedCursorPos) {
                const range = document.createRange();
                range.setStart(node, Math.min(savedCursorPos - charCount, nodeLength));
                range.setEnd(node, Math.min(savedCursorPos - charCount, nodeLength));
                selection.removeAllRanges();
                selection.addRange(range);
                found = true;
                break;
              }
              charCount += nodeLength;
            }
            
            if (!found && textNodes.length > 0) {
              const lastNode = textNodes[textNodes.length - 1];
              const lastLength = lastNode.textContent?.length || 0;
              const range = document.createRange();
              range.setStart(lastNode, lastLength);
              range.setEnd(lastNode, lastLength);
              selection.removeAllRanges();
              selection.addRange(range);
            } else if (wasEmpty && savedCursorPos === 0) {
              const range = document.createRange();
              range.setStart(contentEditableRef.current, 0);
              range.setEnd(contentEditableRef.current, 0);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          } catch (err) {
            const range = document.createRange();
            range.selectNodeContents(contentEditableRef.current);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    });
    
    const textBeforeCursor = text.substring(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);
    
    if (match) {
      const searchTerm = match[1];
      setSearchTerm(searchTerm);
      console.log('[EditPostDialog] @mention detected:', { searchTerm, textBeforeCursor });
      
      if (searchTerm && searchTerm.length > 0) {
        try {
          const usersRef = collection(db, 'users');
          const q = query(
            usersRef,
            where('username', '>=', searchTerm),
            where('username', '<=', searchTerm + '\uf8ff'),
            limit(20)
          );
          
          const querySnapshot = await getDocs(q);
          let results = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              username: data.username || '',
              displayName: data.displayName || '',
              photoURL: data.photoURL,
              privacy: data.privacy
            };
          });
          
          results = results.filter(user => user.privacy?.allowTagging !== false);
          
          if (searchTerm) {
            results = results.filter(user => 
              user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
            );
          }
          
          results = results.slice(0, 20);
          console.log('[EditPostDialog] Search results:', results.length, 'users found', results);
          setSearchResults(results);
          setShowResults(results.length > 0);
          console.log('[EditPostDialog] showResults set to:', results.length > 0);
          
          if (contentEditableRef.current) {
            const editable = contentEditableRef.current;
            const editableRect = editable.getBoundingClientRect();
            
            const span = document.createElement('span');
            span.style.visibility = 'hidden';
            span.style.position = 'absolute';
            span.style.whiteSpace = 'pre-wrap';
            span.style.font = window.getComputedStyle(editable).font;
            span.style.fontSize = window.getComputedStyle(editable).fontSize;
            span.style.fontFamily = window.getComputedStyle(editable).fontFamily;
            span.style.paddingLeft = window.getComputedStyle(editable).paddingLeft;
            span.textContent = textBeforeCursor;
            document.body.appendChild(span);
            const textWidth = span.offsetWidth;
            document.body.removeChild(span);
            
            const lines = textBeforeCursor.split('\n').length - 1;
            const lineHeight = parseInt(window.getComputedStyle(editable).lineHeight) || 24;
            const paddingTop = parseInt(window.getComputedStyle(editable).paddingTop) || 16;
            
            const position = { 
              top: editableRect.top + paddingTop + (lines * lineHeight) + lineHeight + 5, 
              left: editableRect.left + textWidth + 5
            };
            console.log('[EditPostDialog] Dropdown position:', position);
            setDropdownPosition(position);
          }
        } catch (error) {
          console.error('Error searching users:', error);
          setSearchResults([]);
          setShowResults(false);
        }
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    } else {
      setShowResults(false);
    }
  };

  // Handle user selection from mention dropdown
  const handleUserSelect = (selectedUser: any) => {
    if (!contentEditableRef.current) return;
    
    const text = content;
    const beforeCursor = text.substring(0, cursorPosition).replace(/@\w*$/, '');
    const afterCursor = text.substring(cursorPosition);
    const newContent = `${beforeCursor}@${selectedUser.username} ${afterCursor}`;
    setContent(newContent);
    setShowResults(false);
    setSearchTerm('');
    
    // Maximum 99 tagged users
    if (taggedUsers.length >= 99) {
      toast.error('Maximum 99 users can be tagged in a post');
      return;
    }
    
    if (!taggedUsers.includes(selectedUser.id)) {
      setTaggedUsers([...taggedUsers, selectedUser.id]);
    }
    
    const formattedHtml = formatContentWithMentions(newContent);
    const newCursorPos = beforeCursor.length + selectedUser.username.length + 2;
    
    requestAnimationFrame(() => {
      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = formattedHtml || '<br>';
        
        const selection = window.getSelection();
        if (selection) {
          try {
            const textNodes = getTextNodes(contentEditableRef.current);
            let charCount = 0;
            
            for (const node of textNodes) {
              const nodeLength = node.textContent?.length || 0;
              if (charCount + nodeLength >= newCursorPos) {
                const range = document.createRange();
                range.setStart(node, Math.min(newCursorPos - charCount, nodeLength));
                range.setEnd(node, Math.min(newCursorPos - charCount, nodeLength));
                selection.removeAllRanges();
                selection.addRange(range);
                break;
              }
              charCount += nodeLength;
            }
          } catch (err) {
            const range = document.createRange();
            range.selectNodeContents(contentEditableRef.current);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
        
        contentEditableRef.current.focus();
      }
    });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        contentEditableRef.current &&
        !contentEditableRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    if (showResults) {
      document.addEventListener('mousedown', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [showResults]);
  
  // Debug: Log when dropdown state changes
  useEffect(() => {
    if (showResults) {
      console.log('[EditPostDialog] Dropdown state:', { 
        showResults, 
        searchResultsCount: searchResults.length, 
        dropdownPosition,
        searchTerm 
      });
    }
  }, [showResults, searchResults.length, dropdownPosition, searchTerm]);

  // Function to handle emoji click
  const handleEmojiClick = (emoji: string) => {
    if (!contentEditableRef.current) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textNode = document.createTextNode(emoji);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (contentEditableRef.current) {
      const text = contentEditableRef.current.innerText || '';
      setContent(text);
      contentEditableRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Load user verification status
  useEffect(() => {
    const loadUserVerification = async () => {
      if (user?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserProfile(userData);
            
            // Check if user is a verified creator (for paid content monetization)
            const hasCreatorRole = userData.role === 'creator' || userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner';
            setIsCreatorRole(hasCreatorRole);
            
            if (hasCreatorRole) {
              // Admin, superadmin, and owner roles are automatically verified
              if (userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner') {
                setIsVerified(true);
              } else {
                // For regular creators, check BOTH old method (isVerified field) and new method (verificationData collection)
                let verified = false;
                
                // Check old method first (for existing verified creators)
                if (userData.isVerified === true) {
                  verified = true;
                } else {
                  // Check new method (verificationData collection)
                  const verificationDoc = await getDoc(doc(db, 'verificationData', user.uid));
                  if (verificationDoc.exists()) {
                    const verificationData = verificationDoc.data();
                    verified = verificationData.status === 'approved';
                  }
                }
                
                setIsVerified(verified);
              }
            } else {
              // Regular users cannot monetize
              setIsVerified(false);
            }
          }
        } catch (error) {
          console.error('Error loading user verification:', error);
        }
      }
    };

    loadUserVerification();
  }, [user]);

  useEffect(() => {
    if (open) {
      setContent(post.content || '')
      setTaggedUsers(post.taggedUsers || [])
      const level = post.accessSettings?.accessLevel || 'free';
      // Map old values to new values
      if (level === 'followers' || level === 'premium' || level === 'exclusive') {
        setAccessLevel('free_subscriber');
      } else {
        setAccessLevel(level as 'free' | 'free_subscriber' | 'paid_subscriber' | 'ppv');
      }
      setAllowComments(() => {
        if (post.allowComments === false) return 'none';
        if (post.allowComments === true) return 'everyone';
        if (post.commentAccessLevel === 'subscribers') return 'subscribers';
        if (post.commentAccessLevel === 'paid_subscribers') return 'paid_subscribers';
        return 'everyone';
      })
      setPpvPrice(post.accessSettings?.ppvPrice || 0)
      setPpvEveryonePays(post.accessSettings?.ppvEveryonePays ?? true)
      setShowWatermark(post.showWatermark ?? false)
      setIs360Mode(post.type === 'video360' || post.type === 'image360')
      
      // Format content with mentions when dialog opens
      // Use setTimeout to ensure the ref is ready
      setTimeout(() => {
        if (contentEditableRef.current) {
          if (post.content) {
            const formattedHtml = formatContentWithMentions(post.content);
            contentEditableRef.current.innerHTML = formattedHtml || '<br>';
          } else {
            contentEditableRef.current.innerHTML = '<br>';
          }
          // Ensure it's focusable and ready
          contentEditableRef.current.setAttribute('contenteditable', 'true');
        }
      }, 100);
    }
  }, [post, open])

  // Enable wheel scrolling in the modal
  useEffect(() => {
    if (open && dialogRef.current) {
      const handleWheel = (e: WheelEvent) => {
        e.stopPropagation();
        const element = dialogRef.current;
        if (element) {
          element.scrollTop += e.deltaY;
        }
      };

      dialogRef.current.addEventListener('wheel', handleWheel, { passive: false });
      
      return () => {
        if (dialogRef.current) {
          dialogRef.current.removeEventListener('wheel', handleWheel);
        }
      };
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('You must be logged in to edit posts')
      return
    }
    if (user.uid !== post.authorId) {
      toast.error('You can only edit your own posts')
      return
    }

    setIsSubmitting(true)
    try {
      // Build accessSettings object with only defined values
      const accessSettings: any = {
        ...(post.accessSettings || {}),
        accessLevel,
      }
      
      // Only add PPV settings if PPV is selected
      if (accessLevel === 'ppv') {
        accessSettings.ppvPrice = ppvPrice
        accessSettings.ppvEveryonePays = ppvEveryonePays
      }

      // Build comment settings
      let commentSettings: any = {}
      if (allowComments === 'none') {
        commentSettings.allowComments = false
      } else if (allowComments === 'everyone') {
        commentSettings.allowComments = true
      } else {
        commentSettings.allowComments = true
        commentSettings.commentAccessLevel = allowComments
      }

      // Determine post type based on 360 mode
      // NOTE: We don't allow converting regular media to 360° mode via edit
      // because the actual media file isn't converted. Only allow toggling OFF 360° mode.
      let postType = post.type
      
      // Allow switching FROM 360 mode to regular (the media will display correctly)
      if (!is360Mode && initialIs360Mode) {
        if (post.type === 'image360') {
          postType = 'image'
        } else if (post.type === 'video360') {
          postType = 'video'
        }
      }
      
      // If trying to turn ON 360 mode for non-360 media, prevent it
      if (is360Mode && !initialIs360Mode) {
        toast.error('Cannot convert regular media to 360° mode. Please upload as 360° content from the beginning.')
        setIsSubmitting(false)
        return
      }

      // Get final content from contentEditable if it exists
      const finalContent = contentEditableRef.current?.innerText || content;
      
      const updateData: any = {
        content: finalContent.trim(),
        accessSettings,
        allowComments: commentSettings.allowComments,
        showWatermark,
        type: postType,
        taggedUsers: taggedUsers,
      }
      
      // Only include commentAccessLevel if it's defined
      if (commentSettings.commentAccessLevel !== undefined) {
        updateData.commentAccessLevel = commentSettings.commentAccessLevel
      }

      await updatePost(post.id, updateData)
      
      // Send notifications to newly tagged users
      if (taggedUsers.length > 0 && user) {
        try {
          const existingTaggedUsers = post.taggedUsers || [];
          const newlyTaggedUsers = taggedUsers.filter(id => !existingTaggedUsers.includes(id));
          
          for (const taggedUserId of newlyTaggedUsers) {
            if (taggedUserId !== user.uid) {
              await createNotification({
                type: 'mention',
                fromUser: {
                  uid: user.uid,
                  displayName: user.displayName || userProfile?.displayName || '',
                  photoURL: user.photoURL || userProfile?.photoURL || '',
                  username: userProfile?.username || user.email?.split('@')[0] || ''
                },
                toUser: taggedUserId,
                data: {
                  postId: post.id,
                  link: `/post/${post.id}`
                }
              });
            }
          }
        } catch (error) {
          console.error('Error sending mention notifications:', error);
        }
      }

      toast.success('Post updated successfully!')
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating post:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update post')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setContent(post.content || '')
    setTaggedUsers(post.taggedUsers || [])
    setShowResults(false)
    setSearchResults([])
    onOpenChange(false)
  }

  if (!open) return null;

  return (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            // Allow clicks on mention dropdown to pass through
            const target = e.target as HTMLElement;
            const dropdown = target?.closest('[data-mention-dropdown]');
            if (dropdown || target?.getAttribute('data-mention-dropdown')) {
              e.stopPropagation();
              return;
            }
            // Close dialog if clicking on overlay (not on dialog content)
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
          onMouseDown={(e) => {
            // Prevent overlay from blocking dropdown
            const target = e.target as HTMLElement;
            if (target?.closest('[data-mention-dropdown]') || target?.getAttribute('data-mention-dropdown')) {
              e.stopPropagation();
            }
          }}
          style={{ pointerEvents: 'auto' }}
        >
          <div 
            className="w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto" 
            ref={dialogRef}
            onClick={(e) => {
              // Prevent dialog content from closing when clicking inside
              e.stopPropagation();
            }}
            style={{ position: 'relative', zIndex: 51 }}
          >
        <div className="upload-card edit-post-dialog" style={{ position: 'relative', zIndex: 51 }}>
          <div className="upload-title">
            Edit Post
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1 h-6 w-6 bg-transparent hover:bg-transparent text-gray-600 hover:text-gray-800"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="upload-content px-3 py-2">
            <div className="content-area">
              <div className="relative">
                <div
                  ref={contentEditableRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleContentEditableInput}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain');
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                      const range = selection.getRangeAt(0);
                      range.deleteContents();
                      const textNode = document.createTextNode(text);
                      range.insertNode(textNode);
                      range.setStartAfter(textNode);
                      range.setEndAfter(textNode);
                      selection.removeAllRanges();
                      selection.addRange(range);
                    }
                    if (contentEditableRef.current) {
                      contentEditableRef.current.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }}
                  className="text-input pr-8 min-h-[120px] whitespace-pre-wrap break-words"
                  style={{
                    outline: 'none',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                  data-placeholder={`What's on your mind, ${user?.displayName?.split(' ')[0] || 'there'}? Type @ to mention someone`}
                />
                <style dangerouslySetInnerHTML={{__html: `
                  [contenteditable][data-placeholder]:empty:before {
                    content: attr(data-placeholder);
                    color: #9ca3af;
                    pointer-events: none;
                    position: absolute;
                  }
                  [contenteditable] span {
                    color: #2563eb;
                    font-weight: 600;
                  }
                `}} />
                {/* User mention dropdown - rendered in portal to escape dialog */}
                {(() => {
                  const shouldShow = typeof window !== 'undefined' && showResults && searchResults && searchResults.length > 0;
                  console.log('[EditPostDialog] Dropdown render check:', { 
                    shouldShow, 
                    showResults, 
                    searchResultsLength: searchResults?.length,
                    dropdownPosition 
                  });
                  return shouldShow && createPortal(
                  <div 
                    ref={dropdownRef}
                    data-mention-dropdown="true"
                    className="fixed rounded-lg overflow-y-auto border-0"
                    style={{
                      top: `${Math.max(10, dropdownPosition.top)}px`,
                      left: `${Math.max(10, dropdownPosition.left)}px`,
                      width: 'auto',
                      minWidth: '200px',
                      maxWidth: '280px',
                      maxHeight: '240px',
                      display: 'block',
                      pointerEvents: 'auto',
                      isolation: 'isolate',
                      zIndex: 99999,
                      position: 'fixed',
                      visibility: 'visible',
                      opacity: 1,
                      borderRadius: '8px',
                      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      padding: '2px'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        data-mention-dropdown="true"
                        className="flex items-center w-full px-3 py-2 transition-all duration-200 text-left cursor-pointer rounded-md"
                        style={{
                          background: 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#dbeafe';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUserSelect(result);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          handleUserSelect(result);
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                        }}
                        style={{
                          pointerEvents: 'auto',
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent'
                        }}
                      >
                        <Avatar className="w-8 h-8 mr-3 flex-shrink-0">
                          <AvatarImage src={result.photoURL || '/default-avatar.png'} />
                          <AvatarFallback>{result.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start min-w-0 flex-1">
                          <span className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline active:text-blue-800 truncate w-full">{result.username}</span>
                          {result.displayName && result.displayName !== result.username && (
                            <span className="text-xs text-gray-500 truncate w-full">{result.displayName}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>,
                  document.body
                  );
                })()}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="absolute right-2 top-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <Smile className="h-4 w-4 text-yellow-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-64 p-2"
                    sideOffset={5}
                  >
                    <div 
                      id="emoji-picker-grid"
                      className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {[
                        '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃'
                      ].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleEmojiClick(emoji)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-md text-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
                
              {/* Show existing media */}
              {post.mediaUrl && (
                  <div className="mt-1">
                  {post.type.startsWith('image') ? (
                    <div className="relative">
                      <img
                        src={post.mediaUrl}
                        alt="Preview"
                        className="w-full h-64 object-cover rounded-lg"
                      />
                      {showWatermark && (
                        <ContentWatermark 
                          username={user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'User'} 
                        />
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <video
                        src={post.mediaUrl}
                        className="w-full h-64 object-cover rounded-lg"
                        controls
                      />
                      {showWatermark && (
                        <ContentWatermark 
                          username={user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'User'} 
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

           <div className="upload-settings px-3 py-2">
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">360° Mode</div>
                {!initialIs360Mode && (
                  <div className="text-gray-500 text-xs mt-1">
                    Cannot be enabled for regular media
                  </div>
                )}
              </div>
              <div className="setting-control">
                <label className={`flex items-center cursor-pointer ${(!initialIs360Mode && !is360Mode) ? 'opacity-50' : ''}`}>
                  <input
                    type="checkbox"
                    checked={is360Mode}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.checked && !initialIs360Mode) {
                        // Cannot convert regular to 360 mode
                        toast.error('Cannot convert regular media to 360° mode. Please upload as 360° content from the beginning.')
                      } else {
                        setIs360Mode(e.target.checked)
                      }
                    }}
                    className="checkbox"
                    disabled={!initialIs360Mode && !is360Mode}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Show Watermark on Media</div>
              </div>
              <div className="setting-control">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => {
                      e.stopPropagation();
                      setShowWatermark(e.target.checked);
                    }}
                    className="checkbox"
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Allow Comments</div>
              </div>
              <div className="setting-control">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="w-fit px-3 py-1.5 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none hover:shadow-lg hover:scale-[1.02] focus:shadow-lg focus:scale-[1.02] flex items-center gap-2"
                      style={{
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                      }}
                    >
                      {allowComments === 'everyone' && 'Everyone'}
                      {allowComments === 'subscribers' && 'Subscribers Only'}
                      {allowComments === 'paid_subscribers' && 'Paid Subscribers Only'}
                      {allowComments === 'none' && 'No Comments'}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-48 bg-white border-0 p-0 max-h-48 overflow-y-auto"
                    style={{
                      borderRadius: '8px !important',
                      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1) !important',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important',
                      maxHeight: '192px', // 12rem = 192px
                      overflowY: 'auto'
                    }}
                  >
                    <DropdownMenuItem 
                      onClick={() => setAllowComments('everyone')}
                      className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{
                        background: allowComments === 'everyone' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                        color: allowComments === 'everyone' ? 'white' : 'inherit',
                      }}
                    >
                      Everyone
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setAllowComments('subscribers')}
                      className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{
                        background: allowComments === 'subscribers' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                        color: allowComments === 'subscribers' ? 'white' : 'inherit',
                      }}
                    >
                      Subscribers Only
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setAllowComments('paid_subscribers')}
                      className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{
                        background: allowComments === 'paid_subscribers' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                        color: allowComments === 'paid_subscribers' ? 'white' : 'inherit',
                      }}
                    >
                      Paid Subscribers Only
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setAllowComments('none')}
                      className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{
                        background: allowComments === 'none' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                        color: allowComments === 'none' ? 'white' : 'inherit',
                      }}
                    >
                      No Comments
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Post Visibility</div>
              </div>
              <div className="setting-control">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="w-fit px-3 py-1.5 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none hover:shadow-lg hover:scale-[1.02] focus:shadow-lg focus:scale-[1.02] flex items-center gap-2"
                      style={{
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                      }}
                    >
                      {accessLevel === 'free' && 'Free for Everyone'}
                      {accessLevel === 'free_subscriber' && 'Free for Subscribers'}
                      {accessLevel === 'paid_subscriber' && 'Paid Subscribers Only'}
                      {accessLevel === 'ppv' && 'Pay Per View'}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-48 bg-white border-0 p-0 max-h-48 overflow-y-auto"
                    style={{
                      borderRadius: '8px !important',
                      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1) !important',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important',
                      maxHeight: '192px', // 12rem = 192px
                      overflowY: 'auto'
                    }}
                  >
                    <DropdownMenuItem 
                      onClick={() => setAccessLevel('free')}
                      className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{
                        background: accessLevel === 'free' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                        color: accessLevel === 'free' ? 'white' : 'inherit',
                      }}
                    >
                      Free for Everyone
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setAccessLevel('free_subscriber')}
                      className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{
                        background: accessLevel === 'free_subscriber' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                        color: accessLevel === 'free_subscriber' ? 'white' : 'inherit',
                      }}
                    >
                      Free for Subscribers
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setAccessLevel('paid_subscriber')}
                      className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{
                        background: accessLevel === 'paid_subscriber' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                        color: accessLevel === 'paid_subscriber' ? 'white' : 'inherit',
                      }}
                    >
                      Paid Subscribers Only
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setAccessLevel('ppv')}
                      disabled={!isVerified}
                      className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{
                        background: accessLevel === 'ppv' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                        color: accessLevel === 'ppv' ? 'white' : 'inherit',
                        opacity: !isVerified ? 0.5 : 1,
                      }}
                    >
                      Pay Per View {!isVerified && '(Verified Creators Only)'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {accessLevel === 'ppv' && (
              <div className="setting-row">
                <div className="setting-info">
                  <div className="setting-label">PPV Price</div>
                </div>
                <div className="setting-control">
                  <div className="relative w-24">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={ppvPrice}
                      onChange={(e) => setPpvPrice(Number(e.target.value))}
                      className="w-full px-2 py-1 text-sm border rounded-lg"
                      style={{
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                      }}
                    />
                    <span className="absolute right-2 top-1 text-xs text-gray-500">$</span>
                  </div>
                </div>
              </div>
            )}

            {accessLevel === 'ppv' && (
              <div className="setting-row">
                <div className="setting-info">
                  <div className="space-y-0.5">
                    <div className="setting-label">Payment Rules</div>
                  </div>
                </div>
                <div className="setting-control">
                  <div className="space-y-0.5">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="ppvPayment"
                        checked={ppvEveryonePays}
                        onChange={() => setPpvEveryonePays(true)}
                        className="mr-2"
                      />
                      <span className="ml-3 text-sm text-gray-700">Everyone pays</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="ppvPayment"
                        checked={!ppvEveryonePays}
                        onChange={() => setPpvEveryonePays(false)}
                        className="mr-2"
                      />
                      <span className="ml-3 text-sm text-gray-700">Only free subscribers & non-subscribers pay</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="upload-actions">
            <div className="actions-content">
              <div className="action-buttons">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-submit"
                  onClick={handleSubmit}
                  disabled={isSubmitting || (
                    content.trim() === (post.content?.trim() || '') &&
                    allowComments === (() => {
                      if (post.allowComments === false) return 'none';
                      if (post.allowComments === true) return 'everyone';
                      if (post.commentAccessLevel === 'subscribers') return 'subscribers';
                      if (post.commentAccessLevel === 'paid_subscribers') return 'paid_subscribers';
                      return 'everyone';
                    })() &&
                    showWatermark === (post.showWatermark ?? false) &&
                    is360Mode === initialIs360Mode &&
                    accessLevel === (post.accessSettings?.accessLevel || 'free') &&
                    ppvPrice === (post.accessSettings?.ppvPrice || 0) &&
                    ppvEveryonePays === (post.accessSettings?.ppvEveryonePays ?? true)
                  )}
                >
                  {isSubmitting ? 'Saving...' : 'SAVE CHANGES'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}