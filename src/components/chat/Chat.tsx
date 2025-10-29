import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, getDocs, doc, setDoc, updateDoc, getDoc, DocumentData, deleteDoc, Timestamp, writeBatch, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { MessagesAvatar } from '@/components/ui/MessagesAvatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Image as ImageIcon, Video, Smile, Mic, MicOff, Plus, X, Play, Lock, Pause, Trash2, Edit, MoreVertical, UserX, Pin, Search, ChevronUp, ChevronDown, Grid3x3, Check } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
// Firebase Storage imports removed - now using AWS S3
import { ImageUploadPreview } from './ImageUploadPreview';
import { toast } from 'sonner';
import { VideoUploadPreview } from './VideoUploadPreview';
import { VoiceRecorder } from './VoiceRecorder';
import { TipButton } from '@/components/tips/TipButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { useChat } from '@/contexts/ChatContext';
import { FiMessageSquare } from 'react-icons/fi';
import { isUserBlocked } from '@/lib/services/block.service';
import { themeColors } from '@/styles/colors';
import { motion } from 'framer-motion';
import { debounce } from 'lodash';
import { formatDistanceToNow } from 'date-fns';
import type { MessageAttachment } from '@/lib/types/messages';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { canViewProfile } from '@/lib/utils/profileVisibility';
import { deleteFromS3, extractS3KeyFromUrl } from '@/lib/aws/s3';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
  read: boolean;
  type?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  duration?: number;
  status?: 'sent' | 'delivered' | 'read';
  locked?: boolean;
  price?: number;
  unlockedBy?: string[];
  attachments?: MessageAttachment[];
  edited?: boolean;
  isWelcomeMessage?: boolean;
  deleted?: boolean; // WhatsApp-style: true if message was deleted after being seen
}

interface ChatProps {
  recipientId: string;
  recipientName: string;
  hideHeader?: boolean;
  customWidth?: number;
  onClose?: () => void;
  recipientProfile?: {
    username?: string;
    photoURL?: string;
    displayName?: string;
    privacy?: {
      profileVisibility?: 'public' | 'subscribers_only';
    };
  };
}

// Add this function before the Chat component
const ensureChatDocument = async (user: any, recipientId: string) => {
  const userChatId = `${user.uid}_${recipientId}`;
  const recipientChatId = `${recipientId}_${user.uid}`;
  
  const userChatRef = doc(db, 'users', user.uid, 'chats', userChatId);
  const recipientChatRef = doc(db, 'users', recipientId, 'chats', recipientChatId);
  
  const userChatDoc = await getDoc(userChatRef);
  const recipientChatDoc = await getDoc(recipientChatRef);

  // Check if user deleted this chat (either marked as deleted OR completely deleted)
  // If user's chat document doesn't exist, it means they deleted it completely
  const userDeleted = !userChatDoc.exists() || (userChatDoc.exists() && userChatDoc.data().deletedByUser);
  // Recipient deleted if: their document doesn't exist (completely deleted) OR marked as deleted
  const recipientDeleted = !recipientChatDoc.exists() || (recipientChatDoc.exists() && recipientChatDoc.data().deletedByUser);
  
  // Get user's current sharedChatId
  const userCurrentSharedChatId = userChatDoc.exists() ? userChatDoc.data().sharedChatId : null;
  const userHasNewSharedChatId = userCurrentSharedChatId && userCurrentSharedChatId.includes('_') && /_\d{13}$/.test(userCurrentSharedChatId);
  
  let sharedChatId: string;
  
  // Determine sharedChatId - handle deleted chats properly
  let recipientSharedChatId: string | null = null; // For recipient if they deleted
  
  if (userDeleted) {
    // User completely deleted - create a NEW shared chat with timestamp ONLY ONCE (first message after deletion)
    // If they already have a timestamped sharedChatId, they should keep using it (don't create new one every time)
    if (userHasNewSharedChatId) {
      // User already has a new sharedChatId from previous deletion - keep using it for continued conversation
      sharedChatId = userCurrentSharedChatId;
      console.log('🔍 [Chat] ensureChatDocument: User deleted before but has existing new sharedChatId - keeping it:', sharedChatId);
    } else {
      // First message after deletion - create new sharedChatId
      sharedChatId = `${[user.uid, recipientId].sort().join('_')}_${Date.now()}`;
      console.log('🔍 [Chat] ensureChatDocument: User deleted - created NEW sharedChatId for fresh start:', sharedChatId);
    }
  } else if (recipientDeleted) {
    // Recipient deleted, but user didn't
    // User keeps their existing sharedChatId (their history)
    if (userChatDoc.exists() && userChatDoc.data().sharedChatId) {
      sharedChatId = userChatDoc.data().sharedChatId;
    } else {
      sharedChatId = [user.uid, recipientId].sort().join('_');
    }
    
    // Recipient needs a NEW sharedChatId for fresh start (if they completely deleted)
    if (!recipientChatDoc.exists()) {
      recipientSharedChatId = `${[user.uid, recipientId].sort().join('_')}_${Date.now()}`;
      console.log('🔍 [Chat] ensureChatDocument: Recipient completely deleted - created NEW recipientSharedChatId:', recipientSharedChatId, '(sender keeps:', sharedChatId, ')');
    } else {
      console.log('🔍 [Chat] ensureChatDocument: Recipient soft-deleted (has document), no new recipientSharedChatId needed');
    }
  } else {
    // Normal case - both users haven't deleted (according to their personal chat documents)
    // CRITICAL: ALWAYS prioritize user's own sharedChatId from their personal chat document
    // This ensures that if user deleted before and has a new sharedChatId, they keep using it
    // We NEVER use recipient's sharedChatId if user has their own (especially if it's timestamped)
    if (userChatDoc.exists() && userChatDoc.data().sharedChatId) {
      // User has their own sharedChatId in their personal chat - ALWAYS use it
      // This is the key: each user has their own chat folder, and we use THEIR sharedChatId
      sharedChatId = userChatDoc.data().sharedChatId;
      console.log('🔍 [Chat] ensureChatDocument: Using user\'s own sharedChatId from their personal chat:', sharedChatId, '(userHasNewSharedChatId:', userHasNewSharedChatId, ')');
    } else if (recipientChatDoc.exists() && recipientChatDoc.data().sharedChatId) {
      // User doesn't have their own sharedChatId yet, use recipient's as starting point
      sharedChatId = recipientChatDoc.data().sharedChatId;
      console.log('🔍 [Chat] ensureChatDocument: User has no sharedChatId yet, using recipient\'s:', sharedChatId);
    } else {
      // Neither user has a sharedChatId - create new standard one
      sharedChatId = [user.uid, recipientId].sort().join('_');
      console.log('🔍 [Chat] ensureChatDocument: Creating new standard sharedChatId:', sharedChatId);
    }
  }
  
  const sharedChatRef = doc(db, 'chats', sharedChatId);
  const sharedChatDoc = await getDoc(sharedChatRef);

  // Create shared chat document if it doesn't exist
  if (!sharedChatDoc.exists()) {
    await setDoc(sharedChatRef, {
      participants: [user.uid, recipientId],
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // Create or update user's personal chat entry
  if (!userChatDoc.exists()) {
    await setDoc(userChatRef, {
      otherUserId: recipientId,
      sharedChatId: sharedChatId,
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      unreadCount: 0,
      pinned: false,
      deletedByUser: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('🔍 [Chat] ensureChatDocument: Created user chat entry with sharedChatId:', sharedChatId);
  } else {
    // CRITICAL: Each user has their own chat folder - they should ALWAYS keep their own sharedChatId
    // NEVER update user's sharedChatId from their personal chat document - it's their own data
    const currentSharedChatId = userChatDoc.data().sharedChatId;
    
    // If user already has a sharedChatId in their personal chat, use THAT one (never override it)
    // This is the key: each user has their own chat folder with their own sharedChatId
    if (currentSharedChatId && currentSharedChatId !== sharedChatId) {
      // User has their own sharedChatId that's different from what we calculated
      // This means they previously had a conversation (maybe deleted it) - keep using THEIR sharedChatId
      console.log('🔍 [Chat] ensureChatDocument: User has their own sharedChatId, keeping it:', currentSharedChatId, '(calculated:', sharedChatId, ')');
      sharedChatId = currentSharedChatId; // Use user's own sharedChatId from their personal chat folder
    } else if (currentSharedChatId !== sharedChatId) {
      // User doesn't have a sharedChatId yet, or it matches - update to ensure sync
      console.log('🔍 [Chat] ensureChatDocument: Updating user sharedChatId from', currentSharedChatId, 'to', sharedChatId);
      await updateDoc(userChatRef, {
        sharedChatId: sharedChatId,
        deletedByUser: false,
        updatedAt: serverTimestamp()
      });
    }
    // If currentSharedChatId === sharedChatId, no update needed
  }

  // Create or update recipient's personal chat entry
  if (!recipientChatDoc.exists()) {
    // Recipient's chat doesn't exist (they deleted it completely)
    // Use recipientSharedChatId if it was created (for fresh start), otherwise use sender's sharedChatId
    const finalRecipientSharedChatId = recipientSharedChatId || sharedChatId;
    console.log('🔍 [Chat] ensureChatDocument: Creating recipient chat entry with finalRecipientSharedChatId:', finalRecipientSharedChatId, '(recipientSharedChatId:', recipientSharedChatId, ', sharedChatId:', sharedChatId, ')');
    
    await setDoc(recipientChatRef, {
      otherUserId: user.uid,
      sharedChatId: finalRecipientSharedChatId,
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      unreadCount: 0,
      pinned: false,
      deletedByUser: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Create shared chat document for recipient's new chat if it doesn't exist
    if (recipientSharedChatId) {
      const recipientSharedChatRef = doc(db, 'chats', recipientSharedChatId);
      const recipientSharedChatDoc = await getDoc(recipientSharedChatRef);
      
      if (!recipientSharedChatDoc.exists()) {
        console.log('🔍 [Chat] ensureChatDocument: Creating shared chat document for recipientSharedChatId:', recipientSharedChatId);
        await setDoc(recipientSharedChatRef, {
          participants: [user.uid, recipientId],
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }
  } else {
    // Recipient's chat exists - only update if they had soft-deleted it
    // Don't change their sharedChatId if they didn't delete (they should keep their history)
    const wasDeleted = recipientChatDoc.data().deletedByUser;
    
    if (wasDeleted) {
      // They had soft-deleted, now receiving message - sync to sender's sharedChatId
      await updateDoc(recipientChatRef, {
        sharedChatId: sharedChatId,
        deletedByUser: false, // Reset deletion status when receiving a new message
        updatedAt: serverTimestamp()
      });
    }
    // else: Recipient didn't delete - they keep their existing sharedChatId (their history)
  }

  return { sharedChatId, userChatId, recipientSharedChatId };
};

// Add this at the top of the file, after the imports
const waveAnimation = `
@keyframes wave {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.5); }
}
`;

// Add this style tag to your component (only on client side)
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = waveAnimation;
  document.head.appendChild(style);
}

export function Chat({ recipientId, recipientName, hideHeader = false, customWidth, onClose, recipientProfile }: ChatProps) {
  const { user } = useAuth();
  const [isBlocked, setIsBlocked] = useState(false);
  const [checkingBlock, setCheckingBlock] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check subscription status for profile visibility
  const { isSubscriber, isLoading: subscriptionLoading } = useSubscriptionStatus(recipientId);
  
  // Check if user can chat with this profile (profile visibility check)
  const canChat = recipientProfile ? canViewProfile(recipientProfile as any, user?.uid || null, isSubscriber) : true;

  // Check if either user blocked the other (bidirectional for chat)
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!user?.uid || !recipientId) {
        setIsBlocked(false);
        setCheckingBlock(false);
        return;
      }
      
      setCheckingBlock(true);
      try {
        // Check both directions: if current user blocked recipient OR if recipient blocked current user
        const [userBlockedRecipient, recipientBlockedUser] = await Promise.all([
          isUserBlocked(user.uid, recipientId),
          isUserBlocked(recipientId, user.uid)
        ]);
        
        const blocked = userBlockedRecipient || recipientBlockedUser;
        setIsBlocked(blocked);
        console.log('[Chat] Block status:', { 
          userBlockedRecipient, 
          recipientBlockedUser, 
          blocked, 
          sender: user.uid, 
          recipient: recipientId 
        });
      } catch (error) {
        console.error('Error checking block status:', error);
        setIsBlocked(false);
      } finally {
        setCheckingBlock(false);
      }
    };
    
    checkBlockStatus();
  }, [user?.uid, recipientId]);

  // Inject critical CSS immediately to prevent layout shift
  useEffect(() => {
    const styleId = 'chat-critical-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .chat-message-input,
        .chat-message-input input {
          height: 40px !important;
          min-height: 40px !important;
          max-height: 40px !important;
          font-size: 14px !important;
          line-height: 1.5 !important;
        }
        .chat-recipient-name {
          font-size: 16px !important;
          line-height: 1.5 !important;
          display: inline-block !important;
          min-width: 50px !important;
        }
      `;
      document.head.insertBefore(style, document.head.firstChild);
    }
  }, []);
  const router = useRouter();
  const { openChat } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [matchedMessageIndex, setMatchedMessageIndex] = useState(0);
  const [matchedMessageIds, setMatchedMessageIds] = useState<string[]>([]);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  
  // Function to highlight matching text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    // Escape special regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <span key={i} style={{ backgroundColor: '#fef3c7', fontWeight: 600, color: 'black' }}>{part}</span>
      ) : (
        part
      )
    );
  };
  const [messageToDelete, setMessageToDelete] = useState<{ id: string; type: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ file: File; preview: string; type: 'image' | 'video'; locked: boolean; price?: number }>>([]);
  const [isVerifiedCreator, setIsVerifiedCreator] = useState(false);
  const [verifiedCreators, setVerifiedCreators] = useState<Record<string, boolean>>({});
  const [editText, setEditText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [recordingPosition, setRecordingPosition] = useState({ x: 0, y: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const [gestureState, setGestureState] = useState<'idle' | 'recording' | 'cancelling' | 'locking'>('idle');
  const [gestureProgress, setGestureProgress] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const MAX_RECORDING_TIME = 60; // 1 minute in seconds
  const GESTURE_THRESHOLD = 120; // Increased threshold for more intentional cancellation
  const LOCK_THRESHOLD = 150;
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ [key: string]: number }>({});
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const lastUpdateTime = useRef<{ [key: string]: number }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartWidth, setDragStartWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(100);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [shouldCancel, setShouldCancel] = useState(false);
  const [slidePosition, setSlidePosition] = useState(0);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const recipientNameRef = useRef<HTMLSpanElement>(null);

  // Drag handlers for resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartWidth(containerWidth);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartX;
    const newWidth = Math.max(30, Math.min(100, dragStartWidth + (deltaX / window.innerWidth) * 100));
    setContainerWidth(newWidth);
    
    // Save to localStorage
    localStorage.setItem('chat-container-width', newWidth.toString());
  }, [isDragging, dragStartX, dragStartWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Load saved width from localStorage on mount (only for main chat, not popup)
  useEffect(() => {
    if (customWidth) return; // Don't load from localStorage if custom width is provided
    
    const savedWidth = localStorage.getItem('chat-container-width');
    if (savedWidth) {
      setContainerWidth(parseFloat(savedWidth));
    } else {
      // Set default to 100% if no saved width
      setContainerWidth(100);
    }
  }, [customWidth]);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const TYPING_TIMEOUT = 3000; // 3 seconds
  const [recipientStatus, setRecipientStatus] = useState<{ online?: boolean; lastSeen?: any }>({});
  const [userPlanType, setUserPlanType] = useState<'Free' | 'Paid' | null>(null);

  // Check if user is a verified creator
  useEffect(() => {
    const checkVerification = async () => {
      if (!user?.uid) {
        setIsVerifiedCreator(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          setIsVerifiedCreator(false);
          return;
        }

        const userData = userDoc.data();
        const isCreatorRole = userData.role === 'creator' || userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner';
        
        if (isCreatorRole) {
          // Admin, superadmin, and owner roles are automatically verified
          if (userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner') {
            setIsVerifiedCreator(true);
          } else {
            // For regular creators, check verification status
            let verified = false;
            
            if (userData.isVerified === true) {
              verified = true;
            } else {
              const verificationDoc = await getDoc(doc(db, 'verificationData', user.uid));
              if (verificationDoc.exists()) {
                const verificationData = verificationDoc.data();
                verified = verificationData.status === 'approved';
              }
            }
            
            setIsVerifiedCreator(verified);
          }
        } else {
          setIsVerifiedCreator(false);
        }
      } catch (error) {
        console.error('Error checking verification:', error);
        setIsVerifiedCreator(false);
      }
    };

    checkVerification();
  }, [user?.uid]);

  // Check verification status for message senders
  useEffect(() => {
    const checkSenderVerification = async () => {
      const uniqueSenderIds = [...new Set(messages.map(m => m.senderId))];
      const newVerifiedStatus: Record<string, boolean> = {};

      for (const senderId of uniqueSenderIds) {
        // Skip if we already checked this user
        if (verifiedCreators[senderId] !== undefined) {
          newVerifiedStatus[senderId] = verifiedCreators[senderId];
          continue;
        }

        try {
          const userDoc = await getDoc(doc(db, 'users', senderId));
          if (!userDoc.exists()) {
            newVerifiedStatus[senderId] = false;
            continue;
          }

          const userData = userDoc.data();
          const isCreatorRole = userData.role === 'creator' || userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner';
          
          if (isCreatorRole) {
            // Admin, superadmin, and owner roles are automatically verified
            if (userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner') {
              newVerifiedStatus[senderId] = true;
            } else {
              // For regular creators, check verification status
              let verified = false;
              
              if (userData.isVerified === true) {
                verified = true;
              } else {
                const verificationDoc = await getDoc(doc(db, 'verificationData', senderId));
                if (verificationDoc.exists()) {
                  const verificationData = verificationDoc.data();
                  verified = verificationData.status === 'approved';
                }
              }
              
              newVerifiedStatus[senderId] = verified;
            }
          } else {
            newVerifiedStatus[senderId] = false;
          }
        } catch (error) {
          console.error(`Error checking verification for user ${senderId}:`, error);
          newVerifiedStatus[senderId] = false;
        }
      }

      setVerifiedCreators(prev => ({ ...prev, ...newVerifiedStatus }));
    };

    if (messages.length > 0) {
      checkSenderVerification();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, messages.map(m => m.senderId).join(',')]);  

  useEffect(() => {
    if (!user) return;

    let unsubscribe: (() => void) | null = null;
    let unsubscribeUserChat: (() => void) | null = null;
    let currentSharedChatId: string | null = null;

    // Listen to user's personal chat document to get sharedChatId in real-time
    const userChatId = `${user.uid}_${recipientId}`;
    const userChatRef = doc(db, 'users', user.uid, 'chats', userChatId);
    
    // Setup chat listener - this will run whenever the personal chat document changes
    const setupChat = (userChatData: any) => {
      const sharedChatId = userChatData?.sharedChatId;
      
      // If no sharedChatId yet, wait for it to be created
      if (!sharedChatId) {
        console.log('🔍 [Chat] No sharedChatId found - waiting for chat to be created');
        setMessages([]);
        // Clean up old listener if sharedChatId is null (document was deleted)
        if (unsubscribe) {
          console.log('🔍 [Chat] Cleaning up old listener because sharedChatId is null');
          unsubscribe();
          unsubscribe = null;
          currentSharedChatId = null;
        }
        return;
      }
      
      console.log('🔍 [Chat] setupChat called with sharedChatId:', sharedChatId, 'currentSharedChatId:', currentSharedChatId);
      
      // If sharedChatId changed, unsubscribe from old listener first
      if (currentSharedChatId && currentSharedChatId !== sharedChatId && unsubscribe) {
        console.log('🔍 [Chat] SharedChatId changed, unsubscribing from old listener:', currentSharedChatId, '->', sharedChatId);
        unsubscribe();
        unsubscribe = null;
      }
      
      // If we already have a listener for this sharedChatId, don't create another one
      if (currentSharedChatId === sharedChatId && unsubscribe) {
        console.log('🔍 [Chat] Already listening to sharedChatId:', sharedChatId);
        return;
      }
      
      console.log('🔍 [Chat] Setting up new listener for sharedChatId:', sharedChatId);
      currentSharedChatId = sharedChatId;

    // Mark all unread messages from the recipient as read
    const markMessagesAsRead = async () => {
        const messagesRef = collection(db, 'chats', sharedChatId, 'messages');
      const unreadQuery = query(
        messagesRef,
        where('senderId', '==', recipientId),
        where('read', '==', false)
      );
      const snapshot = await getDocs(unreadQuery);
      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => {
        batch.update(docSnap.ref, { 
          read: true,
          status: 'read'
        });
      });
      if (!snapshot.empty) {
        await batch.commit();
      }
        
        // Always reset user's personal chat unreadCount to 0 when opening chat
        await updateDoc(userChatRef, {
          unreadCount: 0,
          updatedAt: serverTimestamp()
        }).catch(() => {
          // Chat might not exist yet, that's ok
        });
      };
      markMessagesAsRead().catch(error => {
        console.error('Error marking messages as read:', error);
      });
      
      // Load current pinned status from user's personal chat
      const pinned = userChatData?.pinned || false;
      setIsPinned(pinned);

      // Listen to messages with real-time updates - ONLY for the current sharedChatId
      const messagesRef = collection(db, 'chats', sharedChatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'));

      unsubscribe = onSnapshot(q, (snapshot) => {
        console.log('🔍 [Chat] onSnapshot received', snapshot.docs.length, 'messages for sharedChatId:', sharedChatId);
        if (snapshot.docs.length > 0) {
          console.log('🔍 [Chat] First message:', {
            id: snapshot.docs[0].id,
            text: snapshot.docs[0].data().text,
            senderId: snapshot.docs[0].data().senderId,
            timestamp: snapshot.docs[0].data().timestamp
          });
        }
        
        // Filter out duplicate messages by ID to prevent showing same message twice
        const seenIds = new Set<string>();
        const mappedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
        
        const newMessages = mappedMessages.filter(msg => {
          if (seenIds.has(msg.id)) {
            console.warn('🔍 [Chat] Duplicate message detected:', msg.id);
            return false;
          }
          seenIds.add(msg.id);
          return true;
        });
        
        console.log('🔍 [Chat] Setting', newMessages.length, 'messages (after filtering duplicates)');
        if (newMessages.length > 0) {
          console.log('🔍 [Chat] Messages to display:', newMessages.map(m => ({ id: m.id, text: m.text, senderId: m.senderId })));
        }
        
      // Reverse to show oldest first (chronological order)
      setMessages(newMessages.reverse());
      
      // Immediately set scroll position to bottom with no animation
      setTimeout(() => {
        scrollToBottom();
      }, 0);

      // Update message status to 'delivered' for new messages
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const messageData = change.doc.data();
          if (messageData.senderId === user.uid && messageData.status === 'sent') {
            // Update to delivered after a short delay
            setTimeout(async () => {
                const messageRef = doc(db, 'chats', sharedChatId, 'messages', change.doc.id);
              await updateDoc(messageRef, { status: 'delivered' });
            }, 1000);
          }
        }
      });
    });
    };

    // Listen to user's personal chat document for real-time updates to sharedChatId
    // Include metadataChanges to listen for all changes, not just content
    unsubscribeUserChat = onSnapshot(userChatRef, { includeMetadataChanges: true }, (userChatDoc) => {
      console.log('🔍 [Chat] User chat document changed, exists:', userChatDoc.exists(), 'hasPendingWrites:', userChatDoc.metadata.hasPendingWrites, 'fromCache:', userChatDoc.metadata.fromCache);
      
      if (userChatDoc.exists()) {
        const userChatData = userChatDoc.data();
        console.log('🔍 [Chat] User chat data:', { 
          sharedChatId: userChatData.sharedChatId,
          lastMessage: userChatData.lastMessage,
          deletedByUser: userChatData.deletedByUser 
        });
        
        // Setup chat - the onSnapshot will fire again when pending writes are committed
        // But we still want to setup with the current data (which might be cached or pending)
        setupChat(userChatData);
      } else {
        // Document doesn't exist yet - will be created when first message is sent
        console.log('🔍 [Chat] Chat document does not exist - will be created when first message is sent');
        setMessages([]);
        // Clean up old listener if document was deleted
        if (unsubscribe) {
          console.log('🔍 [Chat] Cleaning up message listener because document was deleted');
          unsubscribe();
          unsubscribe = null;
          currentSharedChatId = null;
        }
      }
    }, (error) => {
      console.error('🔍 [Chat] Error listening to user chat document:', error);
    });

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeUserChat) unsubscribeUserChat();
      currentSharedChatId = null;
    };
  }, [user, recipientId]);

  useEffect(() => {
    if (!recipientId) return;
    const userRef = doc(db, 'users', recipientId);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      const data = docSnap.data();
      setRecipientStatus({
        online: data?.online,
        lastSeen: data?.lastSeen,
      });
    });
    return () => unsubscribe();
  }, [recipientId, recipientName]);

  useEffect(() => {
    if (!user || !user.uid || !recipientId) return;
    // Fetch the current user's subscription to this creator
    const fetchPlanType = async () => {
      const subsSnap = await getDocs(query(collection(db, 'subscriptions'), where('subscriberId', '==', user.uid), where('creatorId', '==', recipientId), where('status', '==', 'active')));
      let planType: 'Free' | 'Paid' = 'Free';
      if (!subsSnap.empty) {
        const sub = subsSnap.docs[0].data();
        if (sub.planId) {
          const planSnap = await getDocs(query(collection(db, 'plans'), where('id', '==', sub.planId)));
          if (!planSnap.empty) {
            const planData = planSnap.docs[0].data();
            planType = planData.price > 0 ? 'Paid' : 'Free';
          }
        }
      }
      setUserPlanType(planType);
    };
    fetchPlanType();
  }, [user, recipientId]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      // Scroll the container to the bottom
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    // Multiple attempts to scroll to bottom like WhatsApp
    setTimeout(() => scrollToBottom(), 50);
    setTimeout(() => scrollToBottom(), 100);
    setTimeout(() => scrollToBottom(), 200);
    setTimeout(() => scrollToBottom(), 500);
  }, [messages]);

  // Scroll to bottom when chat first loads and refresh metadata
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollToBottom(), 100);
      setTimeout(() => scrollToBottom(), 300);
      setTimeout(() => scrollToBottom(), 600);
    }
    
    // Refresh chat metadata when chat loads to ensure accuracy
    if (user && recipientId) {
      const chatId = [user.uid, recipientId].sort().join('_');
      setTimeout(() => {
        updateChatMetadataFromActualLastMessage(chatId);
      }, 1000);
    }
  }, [recipientId, user]);

  const handleSendFiles = async () => {
    if (selectedFiles.length === 0 || !user) return;

    // Check if user can chat with this profile (profile visibility check)
    if (!canChat) {
      toast.error('You need to subscribe to chat with this creator');
      return;
    }

    // OPTIMISTIC UPDATE: Clear input immediately (especially important on mobile)
    const captionText = newMessage.trim();
    const filesToSend = [...selectedFiles]; // Save files before clearing state
    setNewMessage('');
    filesToSend.forEach(f => URL.revokeObjectURL(f.preview));
    setSelectedFiles([]);
    
    // Keep input focused on mobile to prevent keyboard from closing
    const maintainFocusOnMobile = () => {
      if (isMobile && messageInputRef.current) {
        messageInputRef.current.focus();
        requestAnimationFrame(() => {
          if (messageInputRef.current) {
            messageInputRef.current.focus();
          }
        });
        setTimeout(() => {
          if (messageInputRef.current) {
            messageInputRef.current.focus();
          }
        }, 0);
        setTimeout(() => {
          if (messageInputRef.current) {
            messageInputRef.current.focus();
          }
        }, 150);
      }
    };
    
    maintainFocusOnMobile();

    setUploading(true);
    
    try {
      // Separate images and videos
      const images = filesToSend.filter(f => f.type === 'image');
      const videos = filesToSend.filter(f => f.type === 'video');
      
      // Upload images with caption
      if (images.length > 0) {
        await handleImageUpload(images.map(({ file, locked, price }) => ({ file, locked, price })), captionText);
      }
      
      // Upload videos with caption
      if (videos.length > 0) {
        await handleVideoUpload(videos.map(({ file, locked, price }) => ({ file, locked, price })), captionText);
      }
    } catch (error) {
      console.error('Error sending files:', error);
      toast.error('Failed to send files');
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user can chat with this profile (profile visibility check)
    if (!canChat) {
      toast.error('You need to subscribe to chat with this creator');
      return;
    }
    
    // If there are selected files, send them with caption text
    if (selectedFiles.length > 0) {
      await handleSendFiles();
      return; // Don't send separate text message
    }
    
    // If no files, send text message only
    if (!newMessage.trim()) return;
    
    // OPTIMISTIC UPDATE: Clear input immediately (especially important on mobile)
    const messageTextToSend = newMessage.trim();
    
    // CRITICAL: On mobile, keep input focused to prevent keyboard from closing
    // We'll maintain focus through multiple strategies
    const maintainFocusOnMobile = () => {
      if (isMobile && messageInputRef.current) {
        // Immediate focus
        messageInputRef.current.focus();
        
        // Use requestAnimationFrame for smooth focus restoration
        requestAnimationFrame(() => {
          if (messageInputRef.current) {
            messageInputRef.current.focus();
          }
        });
        
        // Backup setTimeout for focus restoration
        setTimeout(() => {
          if (messageInputRef.current) {
            messageInputRef.current.focus();
          }
        }, 0);
        
        // Keep focus after state updates and scrolls
        setTimeout(() => {
          if (messageInputRef.current) {
            messageInputRef.current.focus();
          }
        }, 100);
        
        setTimeout(() => {
          if (messageInputRef.current) {
            messageInputRef.current.focus();
          }
        }, 250);
      }
    };
    
    // Maintain focus BEFORE clearing (important for mobile)
    maintainFocusOnMobile();
    
    setNewMessage('');
    
    // Maintain focus AFTER clearing (state update)
    maintainFocusOnMobile();
    
    if (user) {
      // Run Firestore operations in background to avoid blocking UI
      // Use setTimeout(0) on mobile to ensure input clearing happens first
      const executeInBackground = isMobile 
        ? () => setTimeout(() => {
            (async () => {
              try {
                await sendMessageAsync(user, recipientId, messageTextToSend);
              } catch (error) {
                console.error('Error sending message:', error);
                toast.error('Failed to send message. Please try again.');
              }
            })();
          }, 0)
        : () => {
            (async () => {
              try {
                await sendMessageAsync(user, recipientId, messageTextToSend);
              } catch (error) {
                console.error('Error sending message:', error);
                toast.error('Failed to send message. Please try again.');
              }
            })();
          };
      
      executeInBackground();
    }
    
    // Scroll to bottom after sending message (don't wait for async operations)
    setTimeout(() => {
      scrollToBottom();
      // Maintain focus on mobile after scroll
      if (isMobile && messageInputRef.current) {
        messageInputRef.current.focus();
      }
    }, 50);
    setTimeout(() => {
      scrollToBottom();
      // Maintain focus on mobile after scroll (backup)
      if (isMobile && messageInputRef.current) {
        messageInputRef.current.focus();
      }
    }, 150);
  };

  // Separate async function to send message (allows better control)
  const sendMessageAsync = async (user: any, recipientId: string, messageTextToSend: string) => {
    // Check if user has a timestamped sharedChatId BEFORE calling ensureChatDocument
    // This is to prevent ensureChatDocument from returning an old sharedChatId
    const userChatIdForSend = `${user.uid}_${recipientId}`;
    const userChatRefPreCheck = doc(db, 'users', user.uid, 'chats', userChatIdForSend);
    const userChatDocPreCheck = await getDoc(userChatRefPreCheck);
    const userCurrentSharedChatIdPreCheck = userChatDocPreCheck.exists() ? userChatDocPreCheck.data().sharedChatId : null;
    const userHasNewSharedChatIdPreCheck = userCurrentSharedChatIdPreCheck && userCurrentSharedChatIdPreCheck.includes('_') && /_\d{13}$/.test(userCurrentSharedChatIdPreCheck);
    
    // Ensure chat documents exist
    const { sharedChatId, userChatId, recipientSharedChatId } = await ensureChatDocument(user, recipientId);
      
    // CRITICAL: If user has a timestamped sharedChatId (from deletion), use it instead of what ensureChatDocument returned
    // This prevents history from returning when user sends a message
    const finalSharedChatIdForUser = userHasNewSharedChatIdPreCheck && userCurrentSharedChatIdPreCheck ? userCurrentSharedChatIdPreCheck : sharedChatId;
    
    const messagesRef = collection(db, 'chats', finalSharedChatIdForUser, 'messages');

      const messageData = {
      text: messageTextToSend,
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Anonymous',
        timestamp: serverTimestamp(),
        read: false,
        status: 'sent',
        type: 'text'
      };

    // Get recipient's actual sharedChatId from their personal chat document
    const recipientChatIdCheck = `${recipientId}_${user.uid}`;
    const recipientChatRefCheck = doc(db, 'users', recipientId, 'chats', recipientChatIdCheck);
    const recipientChatDocCheck = await getDoc(recipientChatRefCheck);
    const recipientActualSharedChatId = recipientChatDocCheck.exists() ? recipientChatDocCheck.data().sharedChatId : null;
    
    console.log('🔍 [Chat] handleSendMessage: Final sender sharedChatId:', finalSharedChatIdForUser, '(from ensureChatDocument:', sharedChatId, ', user has timestamped:', userHasNewSharedChatIdPreCheck, ') | Recipient actual sharedChatId:', recipientActualSharedChatId);
    
    // Send message to sender's sharedChatId (their history)
      await addDoc(messagesRef, messageData);
      
    // CRITICAL: If sender and recipient have different sharedChatIds (one deleted), send message to BOTH
    // This ensures:
    // - User who deleted sees only new messages in their new sharedChatId
    // - User who didn't delete sees all messages including history in their old sharedChatId
    if (recipientActualSharedChatId && recipientActualSharedChatId !== finalSharedChatIdForUser) {
      console.log('🔍 [Chat] handleSendMessage: ✅ Sender and recipient have different sharedChatIds - sending to BOTH:', {
        sender: finalSharedChatIdForUser,
        recipient: recipientActualSharedChatId
      });
      
      // Send message to recipient's sharedChatId too (for their history)
      const recipientMessagesRef = collection(db, 'chats', recipientActualSharedChatId, 'messages');
      await addDoc(recipientMessagesRef, messageData);
      
      // Update recipient's shared chat metadata
      const recipientSharedChatRef = doc(db, 'chats', recipientActualSharedChatId);
      await updateDoc(recipientSharedChatRef, {
      lastMessage: messageTextToSend,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    
    // Update sender's shared chat metadata (use finalSharedChatIdForUser)
    const sharedChatRef = doc(db, 'chats', finalSharedChatIdForUser);
    await updateDoc(sharedChatRef, {
      lastMessage: messageTextToSend,
      lastMessageTime: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Update or create user's personal chat entry
    // This is critical - ensure the document exists with the correct sharedChatId BEFORE returning
    const userChatRef = doc(db, 'users', user.uid, 'chats', userChatId);
    const userChatDocCheck = await getDoc(userChatRef);
    
    if (userChatDocCheck.exists()) {
      // CRITICAL: If user has a timestamped sharedChatId (from deletion), NEVER update it
      const currentUserSharedChatId = userChatDocCheck.data().sharedChatId;
      const userHasTimestampedIdForSend = currentUserSharedChatId && currentUserSharedChatId.includes('_') && /_\d{13}$/.test(currentUserSharedChatId);
      
      // Always use finalSharedChatIdForUser (which respects user's timestamped sharedChatId if they have one)
      await updateDoc(userChatRef, {
        sharedChatId: finalSharedChatIdForUser, // Use the final sharedChatId (user's timestamped one if they have it)
        lastMessage: messageTextToSend,
        lastMessageTime: serverTimestamp(),
        unreadCount: 0, // Sender has no unread messages
        deletedByUser: false, // Reset deletion status if it was set
        updatedAt: serverTimestamp()
      });
    } else {
      // Create personal chat entry if it doesn't exist (was deleted)
      // This will trigger the onSnapshot listener in the Chat component
      await setDoc(userChatRef, {
        otherUserId: recipientId,
        sharedChatId: sharedChatId,
        lastMessage: messageTextToSend,
        lastMessageTime: serverTimestamp(),
        unreadCount: 0,
        pinned: false,
        deletedByUser: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    
    // Force a small delay to ensure Firestore has propagated the update
    // The onSnapshot listener should pick up the change, but this helps ensure it happens
    console.log('🔍 [Chat] handleSendMessage: Created/updated personal chat entry with sharedChatId:', sharedChatId);
    
    // Update recipient's personal chat entry
    const recipientChatId = `${recipientId}_${user.uid}`;
    const recipientChatRef = doc(db, 'users', recipientId, 'chats', recipientChatId);
    const recipientChatDoc = await getDoc(recipientChatRef);
    
    // Update recipient's personal chat entry
    // IMPORTANT: If recipientSharedChatId was created (recipient deleted), use it for their fresh start
    // Otherwise, use sender's sharedChatId
    const finalRecipientSharedChatId = recipientSharedChatId || sharedChatId;
    console.log('🔍 [Chat] handleSendMessage: Updating recipient chat entry with finalRecipientSharedChatId:', finalRecipientSharedChatId, '(recipientSharedChatId:', recipientSharedChatId, ', sharedChatId:', sharedChatId, ')');
    
    if (recipientChatDoc.exists()) {
      const currentUnread = recipientChatDoc.data()?.unreadCount || 0;
      const recipientCurrentSharedChatId = recipientChatDoc.data()?.sharedChatId;
      const recipientDidNotDelete = !recipientChatDoc.data()?.deletedByUser;
      
      // If recipient didn't delete and already has a sharedChatId, keep it (their history)
      // Otherwise, update to the finalRecipientSharedChatId (especially if they deleted and we created a new one)
      if (recipientDidNotDelete && recipientCurrentSharedChatId && recipientCurrentSharedChatId !== finalRecipientSharedChatId) {
        // Recipient didn't delete and has different sharedChatId - keep their existing one (their history)
        console.log('🔍 [Chat] handleSendMessage: Recipient did not delete - keeping their existing sharedChatId:', recipientCurrentSharedChatId);
        await updateDoc(recipientChatRef, {
          lastMessage: messageTextToSend,
          lastMessageTime: serverTimestamp(),
          unreadCount: currentUnread + 1,
          updatedAt: serverTimestamp()
        });
      } else {
        // Update with the final sharedChatId (especially if recipient deleted and has new sharedChatId)
        console.log('🔍 [Chat] handleSendMessage: Updating recipient sharedChatId to:', finalRecipientSharedChatId);
        await updateDoc(recipientChatRef, {
          sharedChatId: finalRecipientSharedChatId,
          lastMessage: messageTextToSend,
          lastMessageTime: serverTimestamp(),
          unreadCount: currentUnread + 1,
          deletedByUser: false, // Reset deletion if they receive a message
          updatedAt: serverTimestamp()
        });
      }
    } else {
      // Create recipient's chat entry if it doesn't exist (they deleted it completely)
      console.log('🔍 [Chat] handleSendMessage: Creating recipient chat entry with sharedChatId:', finalRecipientSharedChatId);
      await setDoc(recipientChatRef, {
        otherUserId: user.uid,
        sharedChatId: finalRecipientSharedChatId,
        lastMessage: messageTextToSend,
        lastMessageTime: serverTimestamp(),
        unreadCount: 1,
        pinned: false,
        deletedByUser: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    
    // Force refresh chat metadata in background (don't block UI)
    // Note: Input already cleared at the start of function for immediate feedback
      setTimeout(async () => {
        try {
        await updateChatMetadataFromActualLastMessage(sharedChatId);
        } catch (error) {
          console.error('Error refreshing chat metadata:', error);
        }
      }, 500);
  };

  const handleImageClick = () => {
    if (isBlocked) return; // Don't allow image upload if blocked
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = Array.from(target.files || []);
      
      const newFiles = await Promise.all(
        files.map(async (file) => ({
          file,
          preview: URL.createObjectURL(file),
          type: 'image' as const,
          locked: false,
          price: undefined
        }))
      );
      
      setSelectedFiles(prev => [...prev, ...newFiles]);
    };
    input.click();
  };

  const handleImageUpload = async (files: { file: File, locked: boolean, price?: number }[], captionText: string = '') => {
    if (!user) return;
    setUploading(true);

    try {
      // Check if user has a timestamped sharedChatId BEFORE calling ensureChatDocument
      const userChatIdForImageFunc = `${user.uid}_${recipientId}`;
      const userChatRefPreCheckImageFunc = doc(db, 'users', user.uid, 'chats', userChatIdForImageFunc);
      const userChatDocPreCheckImageFunc = await getDoc(userChatRefPreCheckImageFunc);
      const userCurrentSharedChatIdPreCheckImageFunc = userChatDocPreCheckImageFunc.exists() ? userChatDocPreCheckImageFunc.data().sharedChatId : null;
      const userHasNewSharedChatIdPreCheckImageFunc = userCurrentSharedChatIdPreCheckImageFunc && userCurrentSharedChatIdPreCheckImageFunc.includes('_') && /_\d{13}$/.test(userCurrentSharedChatIdPreCheckImageFunc);
      
      // Ensure chat documents exist
      const { sharedChatId, userChatId, recipientSharedChatId } = await ensureChatDocument(user, recipientId);
      
      // CRITICAL: If user has a timestamped sharedChatId (from deletion), use it instead
      const finalSharedChatIdForUserImage = userHasNewSharedChatIdPreCheckImageFunc && userCurrentSharedChatIdPreCheckImageFunc ? userCurrentSharedChatIdPreCheckImageFunc : sharedChatId;
      
      const messagesRef = collection(db, 'chats', finalSharedChatIdForUserImage, 'messages');

      // Fetch sender profile from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const senderProfile = userDoc.exists() ? userDoc.data() : {};
      const senderName = senderProfile.displayName || user.displayName || 'Anonymous';
      const senderPhotoURL = senderProfile.photoURL || user.photoURL || '';

      // Upload each file to AWS S3 and create a message
      for (const { file, locked, price } of files) {
        try {
          // Import AWS upload function
          const { uploadChatMedia } = await import('@/lib/aws/upload');
          const url = await uploadChatMedia(file, finalSharedChatIdForUserImage);
          
          const messageData: any = {
            text: captionText,
            imageUrl: url,
            senderId: user.uid,
            senderName,
            senderPhotoURL,
            timestamp: serverTimestamp(),
            read: false,
            type: 'image',
            locked: !!locked,
          };
          
          // Add price if content is locked
          if (locked && price) {
            messageData.price = price;
          }
          
          // Get recipient's actual sharedChatId from their personal chat document
          const recipientChatIdForImage = `${recipientId}_${user.uid}`;
          const recipientChatRefForImage = doc(db, 'users', recipientId, 'chats', recipientChatIdForImage);
          const recipientChatDocForImage = await getDoc(recipientChatRefForImage);
          const recipientActualSharedChatIdForImage = recipientChatDocForImage.exists() ? recipientChatDocForImage.data().sharedChatId : null;
          
          // Send message to sender's sharedChatId (their history) - use finalSharedChatIdForUserImage
          await addDoc(messagesRef, messageData);
          
          // If sender and recipient have different sharedChatIds, send to BOTH
          if (recipientActualSharedChatIdForImage && recipientActualSharedChatIdForImage !== finalSharedChatIdForUserImage) {
            const recipientMessagesRef = collection(db, 'chats', recipientActualSharedChatIdForImage, 'messages');
            await addDoc(recipientMessagesRef, messageData);
            
            // Update recipient's shared chat metadata
            const recipientSharedChatRef = doc(db, 'chats', recipientActualSharedChatIdForImage);
            await updateDoc(recipientSharedChatRef, {
              lastMessage: captionText || '📷 Image',
            lastMessageTime: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          
          // Update sender's shared chat metadata (use finalSharedChatIdForUserImage)
          const sharedChatRef = doc(db, 'chats', finalSharedChatIdForUserImage);
          await updateDoc(sharedChatRef, {
            lastMessage: captionText || '📷 Image',
            lastMessageTime: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          // Update or create user's personal chat entry
          const userChatRef = doc(db, 'users', user.uid, 'chats', userChatId);
          const userChatDocCheck = await getDoc(userChatRef);
          
          if (userChatDocCheck.exists()) {
            await updateDoc(userChatRef, {
              sharedChatId: finalSharedChatIdForUserImage, // Use the final sharedChatId (user's timestamped one if they have it)
              lastMessage: captionText || '📷 Image',
              lastMessageTime: serverTimestamp(),
              unreadCount: 0, // Sender has no unread messages
              deletedByUser: false,
              updatedAt: serverTimestamp()
            });
          } else {
            // Create personal chat entry if it doesn't exist (was deleted)
            await setDoc(userChatRef, {
              otherUserId: recipientId,
              sharedChatId: finalSharedChatIdForUserImage,
              lastMessage: captionText || '📷 Image',
              lastMessageTime: serverTimestamp(),
              unreadCount: 0,
              pinned: false,
              deletedByUser: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          
          // Update recipient's personal chat entry
          const recipientChatId = `${recipientId}_${user.uid}`;
          const recipientChatRef = doc(db, 'users', recipientId, 'chats', recipientChatId);
          const recipientChatDoc = await getDoc(recipientChatRef);
          const finalRecipientSharedChatId = recipientSharedChatId || sharedChatId;
          
          if (recipientChatDoc.exists()) {
            const currentUnread = recipientChatDoc.data()?.unreadCount || 0;
            const recipientCurrentSharedChatId = recipientChatDoc.data()?.sharedChatId;
            const recipientDidNotDelete = !recipientChatDoc.data()?.deletedByUser;
            
            if (recipientDidNotDelete && recipientCurrentSharedChatId && recipientCurrentSharedChatId !== finalRecipientSharedChatId) {
              // Recipient didn't delete - keep their existing sharedChatId (their history)
              await updateDoc(recipientChatRef, {
                lastMessage: captionText || '📷 Image',
                lastMessageTime: serverTimestamp(),
                unreadCount: currentUnread + 1,
                updatedAt: serverTimestamp()
              });
            } else {
              await updateDoc(recipientChatRef, {
                sharedChatId: finalRecipientSharedChatId,
                lastMessage: captionText || '📷 Image',
                lastMessageTime: serverTimestamp(),
                unreadCount: currentUnread + 1,
                deletedByUser: false,
                updatedAt: serverTimestamp()
              });
            }
          } else {
            // Create recipient's chat entry if it doesn't exist
            await setDoc(recipientChatRef, {
              otherUserId: user.uid,
              sharedChatId: finalRecipientSharedChatId,
              lastMessage: captionText || '📷 Image',
              lastMessageTime: serverTimestamp(),
              unreadCount: 1,
              pinned: false,
              deletedByUser: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          
          // Force refresh to ensure accuracy
          setTimeout(() => {
            updateChatMetadataFromActualLastMessage(sharedChatId);
          }, 500);
        } catch (error) {
          console.error('Error uploading image:', error);
          toast.error(`Failed to upload ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Error in image upload process:', error);
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
      setShowImageUpload(false);
    }
  };

  const handleVideoClick = () => {
    if (isBlocked) return; // Don't allow video upload if blocked
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.multiple = true;
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = Array.from(target.files || []);
      
      const newFiles = await Promise.all(
        files.map(async (file) => ({
          file,
          preview: URL.createObjectURL(file),
          type: 'video' as const,
          locked: false,
          price: undefined
        }))
      );
      
      setSelectedFiles(prev => [...prev, ...newFiles]);
    };
    input.click();
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    // Handle video error silently
    toast.error('Error loading video. Please try again.');
  };

  // Handle video upload
  const handleVideoUpload = async (files: { file: File, locked: boolean, price?: number }[], captionText: string = '') => {
    if (!user) return;
    setUploading(true);

    try {
      // Check if user has a timestamped sharedChatId BEFORE calling ensureChatDocument
      const userChatIdForVideoFunc = `${user.uid}_${recipientId}`;
      const userChatRefPreCheckVideoFunc = doc(db, 'users', user.uid, 'chats', userChatIdForVideoFunc);
      const userChatDocPreCheckVideoFunc = await getDoc(userChatRefPreCheckVideoFunc);
      const userCurrentSharedChatIdPreCheckVideoFunc = userChatDocPreCheckVideoFunc.exists() ? userChatDocPreCheckVideoFunc.data().sharedChatId : null;
      const userHasNewSharedChatIdPreCheckVideoFunc = userCurrentSharedChatIdPreCheckVideoFunc && userCurrentSharedChatIdPreCheckVideoFunc.includes('_') && /_\d{13}$/.test(userCurrentSharedChatIdPreCheckVideoFunc);
      
      // Ensure chat documents exist
      const { sharedChatId, userChatId, recipientSharedChatId } = await ensureChatDocument(user, recipientId);
      
      // CRITICAL: If user has a timestamped sharedChatId (from deletion), use it instead
      const finalSharedChatIdForUserVideo = userHasNewSharedChatIdPreCheckVideoFunc && userCurrentSharedChatIdPreCheckVideoFunc ? userCurrentSharedChatIdPreCheckVideoFunc : sharedChatId;
      
      const messagesRef = collection(db, 'chats', finalSharedChatIdForUserVideo, 'messages');

      // Fetch sender profile from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const senderProfile = userDoc.exists() ? userDoc.data() : {};
      const senderName = senderProfile.displayName || user.displayName || 'Anonymous';
      const senderPhotoURL = senderProfile.photoURL || user.photoURL || '';

      // Upload each file to AWS S3 and create a message
      for (const { file, locked, price } of files) {
        try {
          // Import AWS upload function
          const { uploadChatMedia } = await import('@/lib/aws/upload');
          const url = await uploadChatMedia(file, finalSharedChatIdForUserVideo);
          
          const messageData: any = {
            text: captionText,
            videoUrl: url,
            senderId: user.uid,
            senderName,
            senderPhotoURL,
            timestamp: serverTimestamp(),
            read: false,
            type: 'video',
            locked: !!locked,
          };
          
          // Add price if content is locked
          if (locked && price) {
            messageData.price = price;
          }
          
          // Get recipient's actual sharedChatId from their personal chat document
          const recipientChatIdForVideo = `${recipientId}_${user.uid}`;
          const recipientChatRefForVideo = doc(db, 'users', recipientId, 'chats', recipientChatIdForVideo);
          const recipientChatDocForVideo = await getDoc(recipientChatRefForVideo);
          const recipientActualSharedChatIdForVideo = recipientChatDocForVideo.exists() ? recipientChatDocForVideo.data().sharedChatId : null;
          
          // Send message to sender's sharedChatId (their history) - use finalSharedChatIdForUserVideo
          await addDoc(messagesRef, messageData);
          
          // If sender and recipient have different sharedChatIds, send to BOTH
          if (recipientActualSharedChatIdForVideo && recipientActualSharedChatIdForVideo !== finalSharedChatIdForUserVideo) {
            const recipientMessagesRef = collection(db, 'chats', recipientActualSharedChatIdForVideo, 'messages');
            await addDoc(recipientMessagesRef, messageData);
            
            // Update recipient's shared chat metadata
            const recipientSharedChatRef = doc(db, 'chats', recipientActualSharedChatIdForVideo);
            await updateDoc(recipientSharedChatRef, {
              lastMessage: captionText || '🎥 Video',
            lastMessageTime: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          
          // Update sender's shared chat metadata (use finalSharedChatIdForUserVideo)
          const sharedChatRef = doc(db, 'chats', finalSharedChatIdForUserVideo);
          await updateDoc(sharedChatRef, {
            lastMessage: captionText || '🎥 Video',
            lastMessageTime: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          // Update or create user's personal chat entry
          const userChatRef = doc(db, 'users', user.uid, 'chats', userChatId);
          const userChatDocCheck = await getDoc(userChatRef);
          
          if (userChatDocCheck.exists()) {
            await updateDoc(userChatRef, {
              sharedChatId: finalSharedChatIdForUserVideo, // Use the final sharedChatId (user's timestamped one if they have it)
              lastMessage: captionText || '🎥 Video',
              lastMessageTime: serverTimestamp(),
              unreadCount: 0, // Sender has no unread messages
              deletedByUser: false,
              updatedAt: serverTimestamp()
            });
          } else {
            // Create personal chat entry if it doesn't exist (was deleted)
            await setDoc(userChatRef, {
              otherUserId: recipientId,
              sharedChatId: finalSharedChatIdForUserVideo,
              lastMessage: captionText || '🎥 Video',
              lastMessageTime: serverTimestamp(),
              unreadCount: 0,
              pinned: false,
              deletedByUser: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          
          // Update recipient's personal chat entry
          const recipientChatId = `${recipientId}_${user.uid}`;
          const recipientChatRef = doc(db, 'users', recipientId, 'chats', recipientChatId);
          const recipientChatDoc = await getDoc(recipientChatRef);
          const finalRecipientSharedChatId = recipientSharedChatId || sharedChatId;
          
          if (recipientChatDoc.exists()) {
            const currentUnread = recipientChatDoc.data()?.unreadCount || 0;
            const recipientCurrentSharedChatId = recipientChatDoc.data()?.sharedChatId;
            const recipientDidNotDelete = !recipientChatDoc.data()?.deletedByUser;
            
            if (recipientDidNotDelete && recipientCurrentSharedChatId && recipientCurrentSharedChatId !== finalRecipientSharedChatId) {
              // Recipient didn't delete - keep their existing sharedChatId (their history)
              await updateDoc(recipientChatRef, {
                lastMessage: captionText || '🎥 Video',
                lastMessageTime: serverTimestamp(),
                unreadCount: currentUnread + 1,
                updatedAt: serverTimestamp()
              });
            } else {
              await updateDoc(recipientChatRef, {
                sharedChatId: finalRecipientSharedChatId,
                lastMessage: captionText || '🎥 Video',
                lastMessageTime: serverTimestamp(),
                unreadCount: currentUnread + 1,
                deletedByUser: false,
                updatedAt: serverTimestamp()
              });
            }
          } else {
            // Create recipient's chat entry if it doesn't exist
            await setDoc(recipientChatRef, {
              otherUserId: user.uid,
              sharedChatId: finalRecipientSharedChatId,
              lastMessage: captionText || '🎥 Video',
              lastMessageTime: serverTimestamp(),
              unreadCount: 1,
              pinned: false,
              deletedByUser: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          
          // Force refresh to ensure accuracy
          setTimeout(() => {
            updateChatMetadataFromActualLastMessage(sharedChatId);
          }, 500);
        } catch (error) {
          console.error('Error uploading video:', error);
          toast.error(`Failed to upload ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Error in video upload process:', error);
      toast.error('Failed to upload videos');
    } finally {
      setUploading(false);
      setShowVideoUpload(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleAudioError = (event: Event | string) => {
    console.error('Audio error:', event);
    if (event instanceof Event) {
      const audioElement = event.target as HTMLAudioElement;
      console.error('Audio error details:', {
        error: audioElement.error,
        networkState: audioElement.networkState,
        readyState: audioElement.readyState,
        src: audioElement.currentSrc
      });
    }
    toast.error('Error playing voice message. Please try again.');
    setPlayingAudio(null);
  };

  const handleAudioPlay = async (messageId: string, audioUrl: string) => {
    try {
      // Stop any currently playing audio
      if (playingAudio && playingAudio !== messageId) {
        const currentAudio = audioRefs.current[playingAudio];
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
      }

      // Get or create audio element
      let audio = audioRefs.current[messageId];
      if (!audio) {
        audio = new Audio();
        audioRefs.current[messageId] = audio;
        
        audio.onended = () => {
          setPlayingAudio(null);
          setAudioProgress(prev => ({ ...prev, [messageId]: 0 }));
        };
        
        audio.onerror = handleAudioError;
        
        audio.ontimeupdate = () => {
          if (audio.duration) {
            const now = Date.now();
            const lastUpdate = lastUpdateTime.current[messageId] || 0;
            
            // Throttle updates to every 50ms for smoother animation
            if (now - lastUpdate > 50) {
              const progress = (audio.currentTime / audio.duration) * 100;
              lastUpdateTime.current[messageId] = now;
              
              setAudioProgress(prev => ({ ...prev, [messageId]: progress }));
            }
          }
        };
      }

      if (playingAudio === messageId) {
        // If this audio is already playing, stop it
        audio.pause();
        audio.currentTime = 0;
        setPlayingAudio(null);
        setAudioProgress(prev => ({ ...prev, [messageId]: 0 }));
      } else {
        // Set the source and play
        audio.src = audioUrl;
        
        // Wait for the audio to be loaded
        await new Promise<void>((resolve, reject) => {
          const handleCanPlay = () => {
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleError);
            resolve();
          };
          
          const handleError = (e: Event) => {
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleError);
            reject(e);
          };

          audio.addEventListener('canplaythrough', handleCanPlay);
          audio.addEventListener('error', handleError);
          audio.load();
        });

        // Play the audio
        await audio.play();
        setPlayingAudio(messageId);
      }
    } catch (error) {
      console.error('Error in handleAudioPlay:', error);
      toast.error('Error playing voice message');
      setPlayingAudio(null);
    }
  };

  const handleVoiceUpload = async (audioBlob: Blob) => {
    if (!user) return;
    setUploading(true);

    try {
      // Check if user has a timestamped sharedChatId BEFORE calling ensureChatDocument
      const userChatIdForVoice = `${user.uid}_${recipientId}`;
      const userChatRefPreCheckVoice = doc(db, 'users', user.uid, 'chats', userChatIdForVoice);
      const userChatDocPreCheckVoice = await getDoc(userChatRefPreCheckVoice);
      const userCurrentSharedChatIdPreCheckVoice = userChatDocPreCheckVoice.exists() ? userChatDocPreCheckVoice.data().sharedChatId : null;
      const userHasNewSharedChatIdPreCheckVoice = userCurrentSharedChatIdPreCheckVoice && userCurrentSharedChatIdPreCheckVoice.includes('_') && /_\d{13}$/.test(userCurrentSharedChatIdPreCheckVoice);
      
      const { sharedChatId, userChatId, recipientSharedChatId } = await ensureChatDocument(user, recipientId);
      
      // CRITICAL: If user has a timestamped sharedChatId (from deletion), use it instead
      const finalSharedChatIdForUserVoice = userHasNewSharedChatIdPreCheckVoice && userCurrentSharedChatIdPreCheckVoice ? userCurrentSharedChatIdPreCheckVoice : sharedChatId;
      
      const messagesRef = collection(db, 'chats', finalSharedChatIdForUserVoice, 'messages');

      // Upload audio file to AWS S3
      const { uploadAudio } = await import('@/lib/aws/upload');
      const url = await uploadAudio(audioBlob);
      
      // Create message with duration
      const messageData = {
        text: '',
        audioUrl: url,
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous',
        senderPhotoURL: user.photoURL || '',
        timestamp: serverTimestamp(),
        read: false,
        type: 'audio',
        duration: recordingDuration // Add the duration to the message
      };
      
      // Get recipient's actual sharedChatId from their personal chat document
      const recipientChatIdForVoice = `${recipientId}_${user.uid}`;
      const recipientChatRefForVoice = doc(db, 'users', recipientId, 'chats', recipientChatIdForVoice);
      const recipientChatDocForVoice = await getDoc(recipientChatRefForVoice);
      const recipientActualSharedChatIdForVoice = recipientChatDocForVoice.exists() ? recipientChatDocForVoice.data().sharedChatId : null;
      
      // Send message to sender's sharedChatId (their history) - use finalSharedChatIdForUserVoice
      await addDoc(messagesRef, messageData);
      
      // If sender and recipient have different sharedChatIds, send to BOTH
      if (recipientActualSharedChatIdForVoice && recipientActualSharedChatIdForVoice !== finalSharedChatIdForUserVoice) {
        const recipientMessagesRef = collection(db, 'chats', recipientActualSharedChatIdForVoice, 'messages');
        await addDoc(recipientMessagesRef, messageData);
        
        // Update recipient's shared chat metadata
        const recipientSharedChatRef = doc(db, 'chats', recipientActualSharedChatIdForVoice);
        await updateDoc(recipientSharedChatRef, {
          lastMessage: '🎵 Voice message',
          lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // Update sender's shared chat metadata (use finalSharedChatIdForUserVoice)
      const sharedChatRef = doc(db, 'chats', finalSharedChatIdForUserVoice);
      await updateDoc(sharedChatRef, {
        lastMessage: '🎵 Voice message',
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Update or create user's personal chat entry
      const userChatRef = doc(db, 'users', user.uid, 'chats', userChatId);
      const userChatDocCheck = await getDoc(userChatRef);
      
      if (userChatDocCheck.exists()) {
        await updateDoc(userChatRef, {
          sharedChatId: finalSharedChatIdForUserVoice, // Use the final sharedChatId (user's timestamped one if they have it)
          lastMessage: '🎵 Voice message',
          lastMessageTime: serverTimestamp(),
          unreadCount: 0,
          deletedByUser: false,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(userChatRef, {
          otherUserId: recipientId,
          sharedChatId: finalSharedChatIdForUserVoice,
          lastMessage: '🎵 Voice message',
          lastMessageTime: serverTimestamp(),
          unreadCount: 0,
          pinned: false,
          deletedByUser: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // Update recipient's personal chat entry
      const recipientChatId = `${recipientId}_${user.uid}`;
      const recipientChatRef = doc(db, 'users', recipientId, 'chats', recipientChatId);
      const recipientChatDoc = await getDoc(recipientChatRef);
      const finalRecipientSharedChatId = recipientSharedChatId || sharedChatId;
      
      if (recipientChatDoc.exists()) {
        const currentUnread = recipientChatDoc.data()?.unreadCount || 0;
        const recipientCurrentSharedChatId = recipientChatDoc.data()?.sharedChatId;
        const recipientDidNotDelete = !recipientChatDoc.data()?.deletedByUser;
        
        if (recipientDidNotDelete && recipientCurrentSharedChatId && recipientCurrentSharedChatId !== finalRecipientSharedChatId) {
          // Recipient didn't delete - keep their existing sharedChatId (their history)
          await updateDoc(recipientChatRef, {
            lastMessage: '🎵 Voice message',
            lastMessageTime: serverTimestamp(),
            unreadCount: currentUnread + 1,
            updatedAt: serverTimestamp()
          });
        } else {
          await updateDoc(recipientChatRef, {
            sharedChatId: finalRecipientSharedChatId,
            lastMessage: '🎵 Voice message',
            lastMessageTime: serverTimestamp(),
            unreadCount: currentUnread + 1,
            deletedByUser: false,
            updatedAt: serverTimestamp()
          });
        }
      } else {
        await setDoc(recipientChatRef, {
          otherUserId: user.uid,
          sharedChatId: finalRecipientSharedChatId,
          lastMessage: '🎵 Voice message',
          lastMessageTime: serverTimestamp(),
          unreadCount: 1,
          pinned: false,
          deletedByUser: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // Force refresh to ensure accuracy
      setTimeout(() => {
        updateChatMetadataFromActualLastMessage(sharedChatId);
      }, 500);

    } catch (error) {
      console.error('Error uploading voice message:', error);
      toast.error('Failed to upload voice message');
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    console.log('startRecording called');
    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingDuration(0);
      console.log('Recording started');
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= MAX_RECORDING_TIME) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }

        // Wait for the last chunk of data
        await new Promise(resolve => setTimeout(resolve, 100));

        // Create blob and upload
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        await handleVoiceUpload(audioBlob);
      } catch (error) {
        console.error('Error stopping recording:', error);
        toast.error('Error saving voice message');
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      audioChunksRef.current = [];
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      
      toast.info('Recording cancelled');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Function to update chat metadata by querying the actual last message
  const updateChatMetadataFromActualLastMessage = async (chatId: string, excludeDeleted: boolean = false) => {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      let messagesQuery;
      
      const lastMessageSnapshot = excludeDeleted 
        ? await (async () => {
            // Query up to 10 messages and filter out deleted ones client-side
            // (Firestore doesn't support != with null/undefined efficiently)
            const tempQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(10));
            const tempSnapshot = await getDocs(tempQuery);
            // Filter out deleted messages
            const nonDeletedDocs = tempSnapshot.docs.filter(doc => {
              const data = doc.data();
              return !data.deleted;
            });
            // Return the first non-deleted message
            return { docs: nonDeletedDocs.slice(0, 1) } as any;
          })()
        : await getDocs(query(messagesRef, orderBy('timestamp', 'desc'), limit(1)));
      
      const chatRef = doc(db, 'chats', chatId);
      
      if (lastMessageSnapshot.empty) {
        // No messages left, clear last message
        await updateDoc(chatRef, {
          lastMessage: '',
          lastMessageTime: null
        });
      } else {
        // Update with the actual last message
        const lastMsg = lastMessageSnapshot.docs[0].data();
        const lastMessageText = lastMsg.text || (lastMsg.imageUrl ? '📷 Image' : lastMsg.videoUrl ? '🎥 Video' : lastMsg.audioUrl ? '🎵 Voice message' : '');
        
        await updateDoc(chatRef, {
          lastMessage: lastMessageText,
          lastMessageTime: lastMsg.timestamp
        });
        
        // Also update user's personal chat metadata
        if (user) {
          const userChatId = `${user.uid}_${recipientId}`;
          const userChatRef = doc(db, 'users', user.uid, 'chats', userChatId);
          const userChatDoc = await getDoc(userChatRef);
          if (userChatDoc.exists()) {
            await updateDoc(userChatRef, {
              lastMessage: lastMessageText,
              lastMessageTime: lastMsg.timestamp
            });
          }
          
          // Also update recipient's personal chat metadata if different sharedChatId
          const recipientChatId = `${recipientId}_${user.uid}`;
          const recipientChatRef = doc(db, 'users', recipientId, 'chats', recipientChatId);
          const recipientChatDoc = await getDoc(recipientChatRef);
          if (recipientChatDoc.exists()) {
            const recipientSharedChatId = recipientChatDoc.data().sharedChatId;
            if (!recipientSharedChatId || recipientSharedChatId === chatId) {
              await updateDoc(recipientChatRef, {
                lastMessage: lastMessageText,
                lastMessageTime: lastMsg.timestamp
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error updating chat metadata from actual last message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user) return;

    try {
      // Get the correct sharedChatId from user's personal chat document
      const userChatId = `${user.uid}_${recipientId}`;
      const userChatRef = doc(db, 'users', user.uid, 'chats', userChatId);
      const userChatDoc = await getDoc(userChatRef);
      
      // Get sharedChatId from user's personal chat (they may have different ones if they deleted before)
      const sharedChatId = userChatDoc.exists() && userChatDoc.data().sharedChatId 
        ? userChatDoc.data().sharedChatId 
        : [user.uid, recipientId].sort().join('_');
      
      const messageRef = doc(db, 'chats', sharedChatId, 'messages', messageId);
      
      // Get message data to check if it's been read
      const messageDoc = await getDoc(messageRef);
      const messageData = messageDoc.data();
      
      if (!messageData) {
        toast.error('Message not found');
        return;
      }
      
      // Check if message has been read by recipient
      const isRead = messageData.read && messageData.senderId === user.uid;
      
      // Delete media files from S3 if they exist
      try {
        if (messageData.imageUrl) {
          const s3Key = extractS3KeyFromUrl(messageData.imageUrl);
          await deleteFromS3(s3Key);
          console.log(`🗑️ Deleted image from S3: ${s3Key}`);
        }
        if (messageData.videoUrl) {
          const s3Key = extractS3KeyFromUrl(messageData.videoUrl);
          await deleteFromS3(s3Key);
          console.log(`🗑️ Deleted video from S3: ${s3Key}`);
        }
        if (messageData.audioUrl) {
          const s3Key = extractS3KeyFromUrl(messageData.audioUrl);
          await deleteFromS3(s3Key);
          console.log(`🗑️ Deleted audio from S3: ${s3Key}`);
        }
        // Delete attachments
        if (messageData.attachments && Array.isArray(messageData.attachments)) {
          for (const attachment of messageData.attachments) {
            if (attachment.url) {
              try {
                const s3Key = extractS3KeyFromUrl(attachment.url);
                await deleteFromS3(s3Key);
                console.log(`🗑️ Deleted attachment from S3: ${s3Key}`);
              } catch (err) {
                console.warn('Failed to delete attachment:', attachment.url, err);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error deleting media from S3:', err);
        // Continue with message deletion even if S3 deletion fails
      }
      
      // WhatsApp-style deletion: If unread, delete completely. If read, mark as deleted.
      if (!isRead) {
        // Message hasn't been read - delete completely
        await deleteDoc(messageRef);
        
        // If recipient has a different sharedChatId, delete there too
        const recipientChatId = `${recipientId}_${user.uid}`;
        const recipientChatRef = doc(db, 'users', recipientId, 'chats', recipientChatId);
        const recipientChatDoc = await getDoc(recipientChatRef);
        const recipientSharedChatId = recipientChatDoc.exists() && recipientChatDoc.data().sharedChatId 
          ? recipientChatDoc.data().sharedChatId 
          : null;
        
        if (recipientSharedChatId && recipientSharedChatId !== sharedChatId) {
          const recipientMessageRef = doc(db, 'chats', recipientSharedChatId, 'messages', messageId);
          const recipientMessageDoc = await getDoc(recipientMessageRef);
          if (recipientMessageDoc.exists()) {
            await deleteDoc(recipientMessageRef);
            console.log('✅ Also deleted message from recipient\'s sharedChatId');
          }
        }
      } else {
        // Message has been read - mark as deleted (WhatsApp-style)
        const deleteUpdate = {
          deleted: true,
          text: '',
          imageUrl: null,
          videoUrl: null,
          audioUrl: null,
          attachments: null,
          deletedAt: serverTimestamp()
        };
        
        await updateDoc(messageRef, deleteUpdate);
        
        // If recipient has a different sharedChatId, update there too
        const recipientChatId = `${recipientId}_${user.uid}`;
        const recipientChatRef = doc(db, 'users', recipientId, 'chats', recipientChatId);
        const recipientChatDoc = await getDoc(recipientChatRef);
        const recipientSharedChatId = recipientChatDoc.exists() && recipientChatDoc.data().sharedChatId 
          ? recipientChatDoc.data().sharedChatId 
          : null;
        
        if (recipientSharedChatId && recipientSharedChatId !== sharedChatId) {
          const recipientMessageRef = doc(db, 'chats', recipientSharedChatId, 'messages', messageId);
          const recipientMessageDoc = await getDoc(recipientMessageRef);
          if (recipientMessageDoc.exists()) {
            await updateDoc(recipientMessageRef, deleteUpdate);
            console.log('✅ Also updated message in recipient\'s sharedChatId');
          }
        }
      }
      
      // Wait a moment for the deletion to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Update chat metadata by querying the actual last non-deleted message
      await updateChatMetadataFromActualLastMessage(sharedChatId, true);
      const recipientChatId = `${recipientId}_${user.uid}`;
      const recipientChatRef = doc(db, 'users', recipientId, 'chats', recipientChatId);
      const recipientChatDoc = await getDoc(recipientChatRef);
      const recipientSharedChatId = recipientChatDoc.exists() && recipientChatDoc.data().sharedChatId 
        ? recipientChatDoc.data().sharedChatId 
        : null;
      if (recipientSharedChatId && recipientSharedChatId !== sharedChatId) {
        await updateChatMetadataFromActualLastMessage(recipientSharedChatId, true);
      }
      
      toast.success(isRead ? "Message deleted" : "Message deleted");
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error("Failed to delete the message. Please try again.");
    } finally {
      setMessageToDelete(null);
    }
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !user) return;
    
    // Use newMessage from input field instead of editText
    const messageText = newMessage.trim();
    if (!messageText) {
      toast.error('Message cannot be empty');
      return;
    }

    try {
      // Get the correct sharedChatId from user's personal chat document
      const userChatId = `${user.uid}_${recipientId}`;
      const userChatRef = doc(db, 'users', user.uid, 'chats', userChatId);
      const userChatDoc = await getDoc(userChatRef);
      
      // Get sharedChatId from user's personal chat (they may have different ones if they deleted before)
      const sharedChatId = userChatDoc.exists() && userChatDoc.data().sharedChatId 
        ? userChatDoc.data().sharedChatId 
        : [user.uid, recipientId].sort().join('_');
      
      const messageRef = doc(db, 'chats', sharedChatId, 'messages', editingMessage.id);
      
      // Get message data to check if it's been read
      const messageDoc = await getDoc(messageRef);
      const messageData = messageDoc.data();
      
      if (!messageData) {
        toast.error('Message not found');
        return;
      }
      
      // Check if message has been read by recipient
      if (messageData.read && messageData.senderId === user.uid) {
        toast.error('Cannot edit message that has been seen');
        cancelEdit();
        return;
      }
      
      // Update message content
      const editUpdate = {
        text: messageText,
        edited: true,
        editedAt: serverTimestamp()
      };
      
      await updateDoc(messageRef, editUpdate);
      
      // If recipient has a different sharedChatId, update there too
      const recipientChatId = `${recipientId}_${user.uid}`;
      const recipientChatRef = doc(db, 'users', recipientId, 'chats', recipientChatId);
      const recipientChatDoc = await getDoc(recipientChatRef);
      const recipientSharedChatId = recipientChatDoc.exists() && recipientChatDoc.data().sharedChatId 
        ? recipientChatDoc.data().sharedChatId 
        : null;
      
      if (recipientSharedChatId && recipientSharedChatId !== sharedChatId) {
        const recipientMessageRef = doc(db, 'chats', recipientSharedChatId, 'messages', editingMessage.id);
        const recipientMessageDoc = await getDoc(recipientMessageRef);
        if (recipientMessageDoc.exists()) {
          await updateDoc(recipientMessageRef, editUpdate);
          console.log('✅ Also updated message in recipient\'s sharedChatId');
        }
      }
      
      // Update chat metadata if this is the last message
      await updateChatMetadataFromActualLastMessage(sharedChatId, true);
      if (recipientSharedChatId && recipientSharedChatId !== sharedChatId) {
        await updateChatMetadataFromActualLastMessage(recipientSharedChatId, true);
      }
      
      // Clear edit mode and input
      setEditingMessage(null);
      setNewMessage('');
      toast.success('Message edited');
      
      // Refocus input on mobile
      if (isMobile && messageInputRef.current) {
        setTimeout(() => {
          messageInputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Failed to edit message');
    }
  };

  const startEditMessage = (messageId: string, currentText: string) => {
    setEditingMessage({ id: messageId, text: currentText });
    // Copy message text to newMessage input field (WhatsApp-style)
    setNewMessage(currentText);
    // Focus the input field and move cursor to end
    setTimeout(() => {
      if (messageInputRef.current) {
        messageInputRef.current.focus();
        // Move cursor to end of text
        const length = currentText.length;
        messageInputRef.current.setSelectionRange(length, length);
      }
    }, 100);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setNewMessage('');
  };

  // Typing indicator Firestore logic
  useEffect(() => {
    if (!user || !recipientId) return;
    const chatId = [user.uid, recipientId].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      const data = docSnap.data();
      setIsRecipientTyping(!!data?.typing && data.typing !== user.uid);
    });
    return () => unsubscribe();
  }, [user, recipientId]);

  // Set typing status when user types
  const debouncedSetTypingStatus = debounce((isTyping: boolean) => {
    if (!user || !recipientId) return;
    const chatId = [user.uid, recipientId].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    setDoc(chatRef, { typing: isTyping ? user.uid : false }, { merge: true });
  }, 300);

  useEffect(() => {
    if (newMessage) {
      debouncedSetTypingStatus(true);
    } else {
      debouncedSetTypingStatus(false);
    }
  }, [newMessage, user, recipientId]);

  useEffect(() => {
    return () => {
      debouncedSetTypingStatus.cancel();
    };
  }, []);

  // Find last seen message id
  const lastSeenMessageId = (() => {
    if (!messages.length) return null;
    // Find the last message sent by the user that is marked as read
    const sentMessages = messages.filter(m => m.senderId === user?.uid);
    const lastSeen = sentMessages.reverse().find(m => m.read);
    return lastSeen?.id || null;
  })();

  // Show loading state while checking block status
  if (checkingBlock) {
    return (
      <div className="flex flex-col h-full w-full relative chat-container items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Hide chat completely if either user blocked the other
  if (isBlocked) {
    return (
      <div className="flex flex-col h-full w-full relative chat-container items-center justify-center">
        <div className="text-gray-500 text-center">
          <UserX className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2">Chat Not Available</p>
          <p className="text-sm">This conversation is not available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full relative chat-container" style={{ width: '100%', overflow: 'hidden' }}>
      {/* Chat Title Bar */}
      {!hideHeader && (
        <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-200 ${isMobile ? 'fixed top-0 left-0 right-0' : 'sticky top-0'} z-50 bg-white`}
             style={{ borderBottom: '1px solid #e5e7eb', minHeight: '56px', maxHeight: '56px' }}>
          {/* Mobile Back Button */}
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Back to messages"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div
            className="flex items-center gap-3 cursor-pointer hover:underline"
            onClick={() => router.push(`/${recipientProfile?.username || recipientId}`)}
          >
            <div className="relative flex-shrink-0 w-10 h-10">
              <MessagesAvatar 
                src={recipientProfile?.photoURL || '/default-avatar.png'}
                alt={recipientProfile?.displayName || recipientName}
                fallback={(recipientProfile?.displayName || recipientName)?.[0] || '?'}
                size="sm"
              />
            </div>
            <span 
              ref={recipientNameRef}
              className="font-semibold chat-recipient-name" 
              style={{ 
                color: themeColors.brand.blue.deep, 
                fontSize: '16px',
                lineHeight: '1.5',
                display: 'inline-block',
                minWidth: '50px',
              }}
            >
              {recipientProfile?.displayName || recipientName}
            </span>
            {isRecipientTyping && (
              <span
                className="ml-2 text-xs font-medium bg-gradient-to-r from-[#6B3BFF] to-[#2B55FF] bg-clip-text text-transparent select-none"
                style={{
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                typing…
              </span>
            )}
          </div>
          {/* Online/Offline and Last Seen */}
          <div className="ml-2 flex flex-col">
            {recipientStatus.online && (
              <span className="text-xs text-green-500 font-semibold">Online</span>
            )}
          </div>
          
          {/* Action Buttons Group */}
          <div className="ml-auto flex items-center gap-2">
            {/* Gallery Button */}
            <button
              className={`p-1.5 rounded-full hover:bg-gray-100 transition-all duration-200 focus:outline-none ${showGallery ? 'bg-blue-50' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowGallery(!showGallery);
                setShowSearch(false);
                
                // When closing gallery, immediately jump to bottom
                if (showGallery) {
                  setTimeout(() => {
                    scrollToBottom();
                  }, 0);
                }
              }}
              title="View gallery"
            >
              <svg className={`w-5 h-5 ${showGallery ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="16" rx="1" ry="1" strokeWidth="1.5"/>
                <circle cx="17.5" cy="7.5" r="1" fill="currentColor"/>
                <path d="M6 16l4-3 3 2 5-4" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            
            {/* Search Messages Button */}
            <button
              className={`p-1.5 rounded-full hover:bg-gray-100 transition-all duration-200 focus:outline-none ${showSearch ? 'bg-blue-50' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowSearch(!showSearch);
                if (!showSearch) setSearchQuery('');
                setShowGallery(false);
              }}
              title="Search in conversation"
            >
              <Search className={`w-5 h-5 ${showSearch ? 'text-blue-600' : 'text-gray-600'}`} />
            </button>
            
            {/* Pin Conversation Button */}
            <button
              className={`p-1.5 rounded-full hover:bg-gray-100 transition-all duration-200 focus:outline-none ${isPinned ? 'bg-blue-50' : ''}`}
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const chatId = [user?.uid, recipientId].sort().join('_');
                  const chatRef = doc(db, 'chats', chatId);
                  const chatDoc = await getDoc(chatRef);
                  
                  if (chatDoc.exists()) {
                    const currentPinned = chatDoc.data().pinnedBy || {};
                    const newPinned = !isPinned;
                    
                    await updateDoc(chatRef, {
                      [`pinnedBy.${user?.uid}`]: newPinned
                    });
                    
                    setIsPinned(newPinned);
                  }
                } catch (error) {
                  console.error('Error pinning conversation:', error);
                }
              }}
              title={isPinned ? "Unpin conversation" : "Pin conversation"}
            >
              <Pin className={`w-5 h-5 ${isPinned ? 'text-blue-600 fill-blue-600' : 'text-gray-600'}`} />
            </button>
            
          {/* Open in Popup Icon Button - Hidden on mobile */}
            {!isMobile && (
              <button
                className="p-1.5 rounded-full hover:bg-gray-100 transition-all duration-200 focus:outline-none"
                onClick={async (e) => {
                  e.stopPropagation();
                  // Create a minimal user profile for openChat
                  const userProfile = {
                    id: recipientId,
                    uid: recipientId,
                    displayName: recipientProfile?.displayName || recipientName,
                    username: recipientProfile?.username || recipientName,
                    photoURL: recipientProfile?.photoURL || '',
                    email: '',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    isAgeVerified: false,
                    isVerified: false,
                    role: 'user' as const,
                    status: 'active' as const
                  };
                  await openChat(userProfile);
                }}
                title="Open in popup"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Search Bar */}
      {showSearch && (
        <div className="px-4 py-2 border-b border-gray-200 bg-white" style={{ position: isMobile ? 'fixed' : 'relative', top: isMobile ? '56px' : 'auto', left: isMobile ? '0' : 'auto', right: isMobile ? '0' : 'auto', zIndex: 45, border: '3px solid red !important' as any }}>
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search in conversation..."
                value={searchQuery}
                onChange={(e) => {
                  const query = e.target.value;
                  setSearchQuery(query);
                  
                  // Find all matching message IDs
                  if (query.trim()) {
                    const matches = messages
                      .filter(m => m.text?.toLowerCase().includes(query.toLowerCase()))
                      .map(m => m.id);
                    setMatchedMessageIds(matches);
                    setMatchedMessageIndex(0);
                    
                    // Scroll to first match
                    if (matches.length > 0 && messagesContainerRef.current) {
                      setTimeout(() => {
                        const element = document.getElementById(`message-${matches[0]}`);
                        if (element && messagesContainerRef.current) {
                          const container = messagesContainerRef.current;
                          const containerRect = container.getBoundingClientRect();
                          const elementRect = element.getBoundingClientRect();
                          const scrollTop = elementRect.top - containerRect.top + container.scrollTop - (containerRect.height / 2) + (elementRect.height / 2);
                          container.scrollTo({ top: scrollTop, behavior: 'smooth' });
                        }
                      }, 100);
                    }
                  } else {
                    setMatchedMessageIds([]);
                    setMatchedMessageIndex(0);
                  }
                }}
                className="w-full px-2 py-1.5 pl-7 pr-24 rounded-2xl focus:outline-none shadow-lg border-0 text-base"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                  fontSize: '16px' // Prevents zoom on iOS
                }}
                autoFocus
              />
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            </div>
            
            {/* Search Navigation */}
            {searchQuery.trim() && matchedMessageIds.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600">
                  {matchedMessageIndex + 1} / {matchedMessageIds.length}
                </span>
                <button
                  onClick={() => {
                    const prevIndex = matchedMessageIndex > 0 ? matchedMessageIndex - 1 : matchedMessageIds.length - 1;
                    setMatchedMessageIndex(prevIndex);
                    const element = document.getElementById(`message-${matchedMessageIds[prevIndex]}`);
                    if (element && messagesContainerRef.current) {
                      const container = messagesContainerRef.current;
                      const containerRect = container.getBoundingClientRect();
                      const elementRect = element.getBoundingClientRect();
                      const scrollTop = elementRect.top - containerRect.top + container.scrollTop - (containerRect.height / 2) + (elementRect.height / 2);
                      container.scrollTo({ top: scrollTop, behavior: 'smooth' });
                    }
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  title="Previous match"
                >
                  <ChevronUp className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => {
                    const nextIndex = matchedMessageIndex < matchedMessageIds.length - 1 ? matchedMessageIndex + 1 : 0;
                    setMatchedMessageIndex(nextIndex);
                    const element = document.getElementById(`message-${matchedMessageIds[nextIndex]}`);
                    if (element && messagesContainerRef.current) {
                      const container = messagesContainerRef.current;
                      const containerRect = container.getBoundingClientRect();
                      const elementRect = element.getBoundingClientRect();
                      const scrollTop = elementRect.top - containerRect.top + container.scrollTop - (containerRect.height / 2) + (elementRect.height / 2);
                      container.scrollTo({ top: scrollTop, behavior: 'smooth' });
                    }
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  title="Next match"
                >
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            )}
            
            {/* Close Button */}
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
                setMatchedMessageIds([]);
                setMatchedMessageIndex(0);
              }}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              title="Close search"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      )}
      
      {/* Gallery View */}
      {showGallery && (
        <div className={`${isMobile ? 'absolute inset-0' : 'flex-1'} ${isMobile ? 'z-50' : ''} flex flex-col bg-white`} style={{ height: '100%' }}>
          {/* Mobile Gallery Header */}
          {isMobile && (
            <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3" style={{ minHeight: '48px', maxHeight: '48px' }}>
              <button
                onClick={() => {
                  setShowGallery(false);
                  // Scroll to bottom when closing gallery on mobile
                  setTimeout(() => {
                    scrollToBottom();
                  }, 0);
                }}
                className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Back to chat"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-base font-semibold text-gray-900">Gallery</h2>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-2" style={{ paddingTop: isMobile ? '48px' : '0', paddingBottom: '0', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' }}>
            <div className="grid grid-cols-3 gap-2">
            {messages
              .filter(m => (m.type === 'image' && m.imageUrl) || (m.type === 'video' && m.videoUrl))
              .map((message) => {
                const isSender = message.senderId === user?.uid;
                const isLocked = message.locked && !isSender && (!message.unlockedBy || !user?.uid || !message.unlockedBy.includes(user.uid));
                
                return (
                <div key={message.id} className="relative aspect-square group cursor-pointer overflow-hidden rounded-2xl" style={{
                  boxShadow: isLocked 
                    ? 'none' 
                    : '0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 1px 0 rgba(255, 255, 255, 0.5) inset',
                  border: 'none',
                  background: isLocked ? 'transparent' : 'transparent'
                }}>
                  {message.type === 'image' && message.imageUrl ? (
                    <>
                      <img
                        src={message.imageUrl}
                        alt="Gallery image"
                        className="w-full h-full object-cover"
                        style={isLocked ? { filter: 'blur(20px)', pointerEvents: 'none' } : {}}
                        onClick={() => {
                          if (!isLocked && message.imageUrl) {
                            setSelectedImage(message.imageUrl);
                          }
                        }}
                      />
                      {message.locked && isSender && !isLocked && (
                        <div className="absolute top-2 right-2 text-white text-xs font-bold px-2 py-1 rounded shadow-lg z-10" style={{ backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)' }}>
                          PPV
                        </div>
                      )}
                      {message.locked && isSender && !isLocked ? (
                        /* PPV sent by current user - show preview with overlay but no blur in gallery */
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '8px',
                          pointerEvents: 'none'
                        }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            zIndex: 20
                          }}>
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
                              backdropFilter: 'blur(10px)',
                              borderRadius: '50%',
                              padding: '8px',
                              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                              marginBottom: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid rgba(255, 255, 255, 0.3)'
                            }}>
                              <Lock size={20} strokeWidth={2} style={{ color: '#6437ff', filter: 'drop-shadow(0 2px 4px rgba(100, 55, 255, 0.3))' }} />
                            </div>
                            <p style={{ 
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '12px',
                              marginBottom: '8px',
                              textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.4), 0 -1px 1px rgba(255, 255, 255, 0.3)',
                              letterSpacing: '0.5px'
                            }}>${message.price?.toFixed(2) ?? '0.00'}</p>
                            <div
                              className="profile-btn subscribe"
                              style={{
                                fontSize: '12px',
                                padding: '6px 16px',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                pointerEvents: 'none'
                              }}
                            >
                              UNLOCK
                            </div>
                          </div>
                        </div>
                      ) : isLocked && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '8px'
                        }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            zIndex: 20
                          }}>
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
                              backdropFilter: 'blur(10px)',
                              borderRadius: '50%',
                              padding: '8px',
                              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                              marginBottom: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid rgba(255, 255, 255, 0.3)'
                            }}>
                              <Lock size={20} strokeWidth={2} style={{ color: '#6437ff', filter: 'drop-shadow(0 2px 4px rgba(100, 55, 255, 0.3))' }} />
                            </div>
                            <p style={{ 
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '12px',
                              marginBottom: '8px',
                              textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.4), 0 -1px 1px rgba(255, 255, 255, 0.3)',
                              letterSpacing: '0.5px'
                            }}>${message.price?.toFixed(2) ?? '0.00'}</p>
                            <button
                              className="profile-btn subscribe"
                              style={{
                                fontSize: '12px',
                                padding: '6px 16px',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                              }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                const confirmed = window.confirm(`Pay $${message.price?.toFixed(2) ?? '0.00'} to unlock this media?`);
                                if (!confirmed || !user?.uid) return;
                                try {
                                  const chatId = [user.uid, recipientId].sort().join('_');
                                  const messageRef = doc(db, 'chats', chatId, 'messages', message.id);
                                  const messageSnap = await getDoc(messageRef);
                                  if (!messageSnap.exists()) throw new Error('Message not found');
                                  
                                  const currentUnlockedBy = messageSnap.data().unlockedBy || [];
                                  if (!currentUnlockedBy.includes(user.uid)) {
                                    await updateDoc(messageRef, { 
                                      unlockedBy: [...currentUnlockedBy, user.uid] 
                                    });
                                    toast.success('Media unlocked!');
                                  }
                                } catch (err) {
                                  toast.error('Failed to unlock media. Please try again.');
                                }
                              }}
                            >
                              UNLOCK
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : message.type === 'video' && message.videoUrl ? (
                    <div className="w-full h-full relative">
                      <video
                        className="w-full h-full object-cover"
                        style={isLocked ? { filter: 'blur(20px)', pointerEvents: 'none' } : {}}
                        controls={false}
                        muted
                        preload="metadata"
                      >
                        <source src={message.videoUrl} type="video/mp4" />
                      </video>
                      {message.locked && isSender && !isLocked ? (
                        /* PPV video sent by current user - show preview with overlay but no blur in gallery */
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '8px',
                          pointerEvents: 'none'
                        }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            zIndex: 20
                          }}>
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
                              backdropFilter: 'blur(10px)',
                              borderRadius: '50%',
                              padding: '8px',
                              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                              marginBottom: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid rgba(255, 255, 255, 0.3)'
                            }}>
                              <Lock size={20} strokeWidth={2} style={{ color: '#6437ff', filter: 'drop-shadow(0 2px 4px rgba(100, 55, 255, 0.3))' }} />
                        </div>
                            <p style={{ 
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '12px',
                              marginBottom: '8px',
                              textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.4), 0 -1px 1px rgba(255, 255, 255, 0.3)',
                              letterSpacing: '0.5px'
                            }}>${message.price?.toFixed(2) ?? '0.00'}</p>
                            <div
                              className="profile-btn subscribe"
                              style={{
                                fontSize: '12px',
                                padding: '6px 16px',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                pointerEvents: 'none'
                              }}
                            >
                              UNLOCK
                            </div>
                          </div>
                        </div>
                      ) : isLocked ? (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '8px'
                        }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            zIndex: 20
                          }}>
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
                              backdropFilter: 'blur(10px)',
                              borderRadius: '50%',
                              padding: '8px',
                              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                              marginBottom: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid rgba(255, 255, 255, 0.3)'
                            }}>
                              <Lock size={20} strokeWidth={2} style={{ color: '#6437ff', filter: 'drop-shadow(0 2px 4px rgba(100, 55, 255, 0.3))' }} />
                            </div>
                            <p style={{ 
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '12px',
                              marginBottom: '8px',
                              textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.4), 0 -1px 1px rgba(255, 255, 255, 0.3)',
                              letterSpacing: '0.5px'
                            }}>${message.price?.toFixed(2) ?? '0.00'}</p>
                            <button
                              className="profile-btn subscribe"
                              style={{
                                fontSize: '12px',
                                padding: '6px 16px',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                              }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              const confirmed = window.confirm(`Pay $${message.price?.toFixed(2) ?? '0.00'} to unlock this media?`);
                              if (!confirmed || !user?.uid) return;
                              try {
                                const chatId = [user.uid, recipientId].sort().join('_');
                                const messageRef = doc(db, 'chats', chatId, 'messages', message.id);
                                const messageSnap = await getDoc(messageRef);
                                if (!messageSnap.exists()) throw new Error('Message not found');
                                
                                const currentUnlockedBy = messageSnap.data().unlockedBy || [];
                                if (!currentUnlockedBy.includes(user.uid)) {
                                  await updateDoc(messageRef, { 
                                    unlockedBy: [...currentUnlockedBy, user.uid] 
                                  });
                                  toast.success('Media unlocked!');
                                }
                              } catch (err) {
                                toast.error('Failed to unlock media. Please try again.');
                              }
                            }}
                          >
                              UNLOCK
                            </button>
                          </div>
                        </div>
                      ) : (
                        <Play className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-white drop-shadow-lg" />
                      )}
                    </div>
                  ) : null}
                </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
      
      {/* Messages Container */}
      {!showGallery ? (
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-2 py-4 bg-white scrollbar-hide flex flex-col justify-start chat-messages-container relative" 
            style={{ 
              scrollBehavior: 'smooth', 
              scrollbarWidth: 'none',
              paddingTop: isMobile && !hideHeader ? 'calc(56px + 1.5rem)' : '1.5rem',
              paddingBottom: '0',
              msOverflowStyle: 'none' as any,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'stretch',
              height: '100%',
              minHeight: '0',
              overflowY: 'auto',
              width: '100%',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'none'
            }}
            onScroll={(e) => {
              // Show scroll to bottom button when user scrolls up
              const container = e.currentTarget;
              const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
              setShowScrollToBottom(!isAtBottom);
            }}
          >
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            <div className="text-center">
              <div className="text-4xl mb-2">💬</div>
              <p>Start a conversation!</p>
            </div>
          </div>
        ) : (
              <div 
                className="flex flex-col space-y-1 chat-messages-wrapper"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'stretch',
                  width: '100%',
                  gap: '0.1rem',
                  filter: searchQuery ? 'none' : 'none'
                }}
              >
            {messages.map((message, idx) => {
                  // Check if this message matches search query
                  const isHighlighted = searchQuery && message.text?.toLowerCase().includes(searchQuery.toLowerCase());
                  
                  return (
                    <div key={message.id} id={`message-${message.id}`}>
                    {/* Moved the existing message rendering code inside this wrapper */}
          <div
            key={message.id}
              className={`flex w-full chat-message-item ${message.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
            >
            {/* Render image message without frame */}
            {message.type === 'image' && message.imageUrl ? (
              <div className={`flex items-center gap-2 group ${message.senderId === user?.uid ? 'justify-end' : 'justify-start'}`} style={{ maxWidth: '80%' }}>
                {/* Message actions for image - on white background (left side) */}
                {message.senderId === user?.uid && !message.read && !message.deleted && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMessageToDelete({ id: message.id, type: message.type || 'text' });
                      }}
                      className="p-1.5 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition-colors"
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {message.deleted ? (
                  <div className={`relative rounded-2xl px-2.5 py-1.5 md:px-2 md:py-1 border shadow chat-message-bubble ${
                    message.senderId === user?.uid 
                      ? 'text-white shadow-sm'
                      : 'bg-gray-100 text-black border-gray-100 shadow-sm'
                  }`} style={{
                    ...(message.senderId === user?.uid ? { 
                      backgroundColor: '#2389FF', 
                      borderColor: '#2389FF' 
                    } : {}),
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    fontStyle: 'italic'
                  } as React.CSSProperties}>
                    <span className={`text-sm ${message.senderId === user?.uid ? 'text-white' : 'text-gray-500'}`}>This message was deleted</span>
                  </div>
                ) : (
                
                <div className="relative">
                  {/* Check if image is locked and user is receiver OR if sender sent PPV */}
                  {message.locked && message.senderId !== user?.uid ? (
                    <div 
                      className="overflow-hidden"
                      style={{
                        borderRadius: '18px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 248, 255, 0.95) 100%)',
                        padding: '4px'
                      }}
                    >
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img
                          src={message.imageUrl}
                          alt="Locked image"
                          style={{
                            borderRadius: '14px',
                            maxWidth: '100%',
                            maxHeight: '400px',
                            display: 'block',
                            filter: 'blur(20px)',
                            pointerEvents: 'none'
                          }}
                        />
                        
                        {/* Lock overlay */}
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '14px'
                        }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            zIndex: 20
                          }}>
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
                              backdropFilter: 'blur(10px)',
                              borderRadius: '50%',
                              padding: '12px',
                              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                              marginBottom: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid rgba(255, 255, 255, 0.3)'
                            }}>
                              <Lock size={24} strokeWidth={2} style={{ color: '#6437ff', filter: 'drop-shadow(0 2px 4px rgba(100, 55, 255, 0.3))' }} />
                            </div>
                            {message.price && (
                              <p style={{ 
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: '12px',
                                marginBottom: '10px',
                                textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.4), 0 -1px 1px rgba(255, 255, 255, 0.3)',
                                letterSpacing: '0.5px'
                              }}>${message.price.toFixed(2)}</p>
                            )}
                            <button
                              className="profile-btn subscribe"
                              style={{
                                fontSize: '12px',
                                padding: '6px 16px',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                              }}
                              onClick={() => {
                                toast.info('Payment system coming soon!');
                              }}
                            >
                              UNLOCK
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Caption text below locked content */}
                      {message.text && (
                        <div className="px-3 py-2 text-sm md:text-sm leading-relaxed" style={{
                          color: '#1a1a1a',
                        }}>
                          {message.text}
                        </div>
                      )}
                      
                      {/* Tip button for received locked images */}
                      {verifiedCreators[message.senderId] === true && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          padding: '2px 8px 2px',
                          borderTop: '1px solid rgba(0, 0, 0, 0.05)'
                        }}>
                          <div style={{ transform: 'translateY(3px)' }}>
                            <TipButton
                              creatorId={message.senderId}
                              creatorName={message.senderName}
                              context={{
                                type: 'message',
                                id: message.id,
                                mediaType: 'image',
                              }}
                              variant="ghost"
                              size="icon"
                              showLabel={false}
                              className="scale-100"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : message.locked && message.senderId === user?.uid ? (
                    /* PPV sent by current user - show preview with overlay but no blur */
                    <div 
                      className="overflow-hidden"
                      style={{
                        borderRadius: '18px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 248, 255, 0.95) 100%)',
                        padding: '4px'
                      }}
                    >
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img
                          src={message.imageUrl}
                          alt="PPV image"
                          style={{
                            borderRadius: '14px',
                            maxWidth: '100%',
                            maxHeight: '400px',
                            cursor: 'pointer',
                            display: 'block'
                          }}
                          className="hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedImage(message.imageUrl!)}
                        />
                        
                        {/* PPV overlay for sender - same as locked but without blur */}
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '14px',
                          pointerEvents: 'none'
                        }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            zIndex: 20
                          }}>
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
                              backdropFilter: 'blur(10px)',
                              borderRadius: '50%',
                              padding: '12px',
                              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                              marginBottom: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid rgba(255, 255, 255, 0.3)'
                            }}>
                              <Lock size={24} strokeWidth={2} style={{ color: '#6437ff', filter: 'drop-shadow(0 2px 4px rgba(100, 55, 255, 0.3))' }} />
                            </div>
                            {message.price && (
                              <p style={{ 
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: '12px',
                                marginBottom: '10px',
                                textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.4), 0 -1px 1px rgba(255, 255, 255, 0.3)',
                                letterSpacing: '0.5px'
                              }}>${message.price.toFixed(2)}</p>
                            )}
                            <div
                              className="profile-btn subscribe"
                              style={{
                                fontSize: '12px',
                                padding: '6px 16px',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                pointerEvents: 'none'
                              }}
                            >
                              UNLOCK
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Caption text below PPV content */}
                      {message.text && (
                        <div className="px-3 py-2 text-sm md:text-sm leading-relaxed" style={{
                          color: '#1a1a1a',
                        }}>
                          {message.text}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div 
                      className="overflow-hidden"
                      style={{
                        borderRadius: '18px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 248, 255, 0.95) 100%)',
                        padding: '4px'
                      }}
                    >
                      <img
                        src={message.imageUrl}
                        alt="Sent image"
                        style={{
                          borderRadius: '14px',
                          maxWidth: '100%',
                          maxHeight: '400px',
                          cursor: 'pointer',
                          display: 'block'
                        }}
                        className="hover:opacity-90 transition-opacity"
                        onClick={() => setSelectedImage(message.imageUrl!)}
                      />
                      
                      {/* Caption text if present */}
                      {message.text && (
                        <div className="px-3 py-2 text-sm md:text-sm leading-relaxed" style={{
                          color: '#1a1a1a',
                        }}>
                          {message.text}
                        </div>
                      )}
                      
                      {/* Tip button for received images */}
                      {message.senderId !== user?.uid && verifiedCreators[message.senderId] === true && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          padding: '2px 8px 2px',
                          borderTop: '1px solid rgba(0, 0, 0, 0.05)'
                        }}>
                          <div style={{ transform: 'translateY(3px)' }}>
                            <TipButton
                              creatorId={message.senderId}
                              creatorName={message.senderName}
                              context={{
                                type: 'message',
                                id: message.id,
                                mediaType: 'image',
                              }}
                              variant="ghost"
                              size="icon"
                              showLabel={false}
                              className="scale-100"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}
              </div>
            ) : message.type === 'video' && message.videoUrl ? (
              <div className={`flex items-center gap-2 group ${message.senderId === user?.uid ? 'justify-end' : 'justify-start'}`} style={{ maxWidth: '80%' }}>
                {/* Message actions for video - on white background (left side) */}
                {message.senderId === user?.uid && !message.read && !message.deleted && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMessageToDelete({ id: message.id, type: message.type || 'text' });
                      }}
                      className="p-1.5 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition-colors"
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {message.deleted ? (
                  <div className={`relative rounded-2xl px-2.5 py-1.5 md:px-2 md:py-1 border shadow chat-message-bubble ${
                    message.senderId === user?.uid 
                      ? 'text-white shadow-sm'
                      : 'bg-gray-100 text-black border-gray-100 shadow-sm'
                  }`} style={{
                    ...(message.senderId === user?.uid ? { 
                      backgroundColor: '#2389FF', 
                      borderColor: '#2389FF' 
                    } : {}),
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    fontStyle: 'italic'
                  } as React.CSSProperties}>
                    <span className={`text-sm ${message.senderId === user?.uid ? 'text-white' : 'text-gray-500'}`}>This message was deleted</span>
                  </div>
                ) : (
                
                <div className="relative">
                  {/* Check if video is locked and user is receiver OR if sender sent PPV */}
                  {message.locked && message.senderId !== user?.uid ? (
                    <div 
                      className="overflow-hidden"
                      style={{
                        borderRadius: '18px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 248, 255, 0.95) 100%)',
                        padding: '4px'
                      }}
                    >
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <video
                          style={{
                            borderRadius: '14px',
                            maxWidth: '100%',
                            maxHeight: '400px',
                            display: 'block',
                            filter: 'blur(20px)',
                            pointerEvents: 'none'
                          }}
                          playsInline
                          preload="metadata"
                        >
                          <source src={message.videoUrl} type="video/mp4" />
                        </video>
                        
                        {/* Lock overlay */}
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '14px'
                        }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            zIndex: 20
                          }}>
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
                              backdropFilter: 'blur(10px)',
                              borderRadius: '50%',
                              padding: '12px',
                              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                              marginBottom: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid rgba(255, 255, 255, 0.3)'
                            }}>
                              <Lock size={24} strokeWidth={2} style={{ color: '#6437ff', filter: 'drop-shadow(0 2px 4px rgba(100, 55, 255, 0.3))' }} />
                            </div>
                            {message.price && (
                              <p style={{ 
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: '12px',
                                marginBottom: '10px',
                                textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.4), 0 -1px 1px rgba(255, 255, 255, 0.3)',
                                letterSpacing: '0.5px'
                              }}>${message.price.toFixed(2)}</p>
                            )}
                            <button
                              className="profile-btn subscribe"
                              style={{
                                fontSize: '12px',
                                padding: '6px 16px',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                              }}
                              onClick={() => {
                                toast.info('Payment system coming soon!');
                              }}
                            >
                              UNLOCK
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Caption text below locked content */}
                      {message.text && (
                        <div className="px-3 py-2 text-sm md:text-sm leading-relaxed" style={{
                          color: '#1a1a1a',
                        }}>
                          {message.text}
                        </div>
                      )}
                      
                      {/* Tip button for received locked videos */}
                      {verifiedCreators[message.senderId] === true && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          padding: '2px 8px 2px',
                          borderTop: '1px solid rgba(0, 0, 0, 0.05)'
                        }}>
                          <div style={{ transform: 'translateY(3px)' }}>
                            <TipButton
                              creatorId={message.senderId}
                              creatorName={message.senderName}
                              context={{
                                type: 'message',
                                id: message.id,
                                mediaType: 'video',
                              }}
                              variant="ghost"
                              size="icon"
                              showLabel={false}
                              className="scale-100"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : message.locked && message.senderId === user?.uid ? (
                    /* PPV video sent by current user - show preview with overlay but no blur */
                    <div 
                      className="overflow-hidden"
                      style={{
                        borderRadius: '18px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 248, 255, 0.95) 100%)',
                        padding: '4px'
                      }}
                    >
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <video
                          style={{
                            borderRadius: '14px',
                            maxWidth: '100%',
                            maxHeight: '400px',
                            cursor: 'pointer',
                            display: 'block'
                          }}
                          className="hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedVideo(message.videoUrl!)}
                          playsInline
                          preload="metadata"
                        >
                          <source src={message.videoUrl} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                        
                        {/* PPV overlay for sender - same as locked but without blur */}
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '14px',
                          pointerEvents: 'none'
                        }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            zIndex: 20
                          }}>
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
                              backdropFilter: 'blur(10px)',
                              borderRadius: '50%',
                              padding: '12px',
                              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                              marginBottom: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid rgba(255, 255, 255, 0.3)'
                            }}>
                              <Lock size={24} strokeWidth={2} style={{ color: '#6437ff', filter: 'drop-shadow(0 2px 4px rgba(100, 55, 255, 0.3))' }} />
                            </div>
                            {message.price && (
                              <p style={{ 
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: '12px',
                                marginBottom: '10px',
                                textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.4), 0 -1px 1px rgba(255, 255, 255, 0.3)',
                                letterSpacing: '0.5px'
                              }}>${message.price.toFixed(2)}</p>
                            )}
                            <div
                              className="profile-btn subscribe"
                              style={{
                                fontSize: '12px',
                                padding: '6px 16px',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                pointerEvents: 'none'
                              }}
                            >
                              UNLOCK
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Caption text below PPV content */}
                      {message.text && (
                        <div className="px-3 py-2 text-sm md:text-sm leading-relaxed" style={{
                          color: '#1a1a1a',
                        }}>
                          {message.text}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div 
                      className="overflow-hidden"
                      style={{
                        borderRadius: '18px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 248, 255, 0.95) 100%)',
                        padding: '4px'
                      }}
                    >
                      <video
                        style={{
                          borderRadius: '14px',
                          maxWidth: '100%',
                          maxHeight: '400px',
                          cursor: 'pointer',
                          display: 'block'
                        }}
                        className="hover:opacity-90 transition-opacity"
                        onClick={() => setSelectedVideo(message.videoUrl!)}
                        playsInline
                        preload="metadata"
                      >
                        <source src={message.videoUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                      
                      {/* Caption text if present */}
                      {message.text && (
                        <div className="px-3 py-2 text-sm md:text-sm leading-relaxed" style={{
                          color: '#1a1a1a',
                        }}>
                          {message.text}
                        </div>
                      )}
                      
                      {/* Tip button for received videos */}
                      {message.senderId !== user?.uid && verifiedCreators[message.senderId] === true && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          padding: '2px 8px 2px',
                          borderTop: '1px solid rgba(0, 0, 0, 0.05)'
                        }}>
                          <div style={{ transform: 'translateY(3px)' }}>
                            <TipButton
                              creatorId={message.senderId}
                              creatorName={message.senderName}
                              context={{
                                type: 'message',
                                id: message.id,
                                mediaType: 'video',
                              }}
                              variant="ghost"
                              size="icon"
                              showLabel={false}
                              className="scale-100"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}
              </div>
            ) : message.type === 'audio' && message.audioUrl ? (
              <div className={`flex items-center gap-2 group ${message.senderId === user?.uid ? 'justify-end' : 'justify-start'}`} style={{ maxWidth: '80%' }}>
                {/* Message actions for voice - on white background (left side) */}
                {message.senderId === user?.uid && !message.read && !message.deleted && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMessageToDelete({ id: message.id, type: message.type || 'text' });
                      }}
                      className="p-1.5 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition-colors"
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {message.deleted ? (
                  <div className={`relative rounded-2xl px-2.5 py-1.5 md:px-2 md:py-1 border shadow chat-message-bubble ${
                    message.senderId === user?.uid 
                      ? 'text-white shadow-sm'
                      : 'bg-gray-100 text-black border-gray-100 shadow-sm'
                  }`} style={{
                    ...(message.senderId === user?.uid ? { 
                      backgroundColor: '#2389FF', 
                      borderColor: '#2389FF' 
                    } : {}),
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    fontStyle: 'italic'
                  } as React.CSSProperties}>
                    <span className={`text-sm ${message.senderId === user?.uid ? 'text-white' : 'text-gray-500'}`}>This message was deleted</span>
                  </div>
                ) : (
                <div className={`relative rounded-2xl px-2 py-1 md:px-2 md:py-1.5 border shadow chat-message-bubble ${
                  message.senderId === user?.uid 
                    ? 'text-white shadow-sm'
                    : 'bg-gray-100 text-black border-gray-100 shadow-sm'
                }`} style={{
                  ...(message.senderId === user?.uid ? { backgroundColor: '#2389FF', borderColor: '#2389FF', background: '#2389FF' } : {}),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  minWidth: 'fit-content'
                } as React.CSSProperties}>
                  <div className="flex items-center gap-2">
                    {/* Play/Pause Button */}
                    <button
                      className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 flex-shrink-0 ${
                        message.senderId === user?.uid
                          ? (playingAudio === message.id 
                              ? 'bg-white text-blue-500' 
                              : 'bg-white/20 text-white hover:bg-white/30')
                          : (playingAudio === message.id
                              ? 'bg-black text-white'
                              : 'bg-gray-300 text-black hover:bg-gray-400')
                      }`}
                      onClick={() => handleAudioPlay(message.id, message.audioUrl!)}
                    >
                      {playingAudio === message.id ? (
                        <Pause className="w-3 h-3" />
                      ) : (
                        <Play className="w-3 h-3 ml-0.5" />
                      )}
                    </button>
                    
                    {/* Progress Bar */}
                    <div 
                      className={`flex-1 min-w-0 rounded-full overflow-hidden ${
                        message.senderId === user?.uid ? 'bg-white/30' : 'bg-gray-300'
                      }`}
                      style={{
                        height: '6px',
                        minWidth: '60px',
                        position: 'relative'
                      }}
                    >
                      <div 
                        className={`rounded-full ${message.senderId === user?.uid ? 'bg-white' : 'bg-black'}`}
                        style={{
                          height: '100%',
                          width: `${audioProgress[message.id] || 0}%`,
                          minWidth: playingAudio === message.id ? '2px' : '0px',
                          transition: 'width 0.1s linear'
                        }}
                      />
                    </div>
                    
                    {/* Duration */}
                    <span className={`text-xs font-mono flex-shrink-0 ${
                      message.senderId === user?.uid ? 'text-white/80' : 'text-black/80'
                    }`}>
                      {message.duration ? formatDuration(message.duration) : '0:00'}
                    </span>
                  </div>
                </div>
                )}
              </div>
            ) : (
              <div className={`flex items-center gap-2 group ${message.senderId === user?.uid ? 'justify-end' : 'justify-start'}`} style={{ maxWidth: '80%' }}>
                {/* Message actions for text - on white background (left side) */}
                {message.senderId === user?.uid && !message.read && !editingMessage && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditMessage(message.id, message.text);
                      }}
                      className="p-1.5 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition-colors"
                      title="Edit message"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMessageToDelete({ id: message.id, type: message.type || 'text' });
                      }}
                      className="p-1.5 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition-colors"
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                {message.deleted ? (
                  <div className={`relative rounded-2xl px-2.5 py-1.5 md:px-2 md:py-1 border shadow chat-message-bubble ${
                    message.senderId === user?.uid 
                      ? 'text-white shadow-sm'
                      : 'bg-gray-100 text-black border-gray-100 shadow-sm'
                  }`} style={{
                    ...(message.senderId === user?.uid ? { 
                      backgroundColor: '#2389FF', 
                      borderColor: '#2389FF' 
                    } : {}),
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    fontStyle: 'italic'
                  } as React.CSSProperties}>
                    <span className={`text-sm ${message.senderId === user?.uid ? 'text-white' : 'text-gray-500'}`}>This message was deleted</span>
                  </div>
                ) : (
                  <div className={`relative rounded-2xl px-2.5 py-1.5 md:px-2 md:py-1 border shadow chat-message-bubble ${
                    message.senderId === user?.uid 
                      ? 'text-white shadow-sm'
                      : 'bg-gray-100 text-black border-gray-100 shadow-sm'
                  }`} style={{
                    ...(message.senderId === user?.uid ? { 
                      backgroundColor: '#2389FF', 
                      borderColor: '#2389FF',
                      background: '#2389FF'
                    } : {}),
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    minWidth: 'fit-content'
                  } as React.CSSProperties}>
                    {/* Text content - WhatsApp-style: editing happens in input field */}
                    <div className="text-left">
                      {/* Welcome message with image support */}
                      {message.isWelcomeMessage && message.imageUrl ? (
                        <div className="space-y-2">
                          <img
                            src={message.imageUrl}
                            alt="Welcome image"
                            className="w-full max-w-sm h-48 object-cover rounded-lg border border-gray-200"
                          />
                          <p className="text-sm md:text-sm break-words whitespace-normal">
                            {searchQuery ? highlightText(message.text || '', searchQuery) : message.text}
                            {message.edited && (
                              <span className="text-xs text-gray-400 ml-1">(edited)</span>
                            )}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm md:text-sm break-words whitespace-normal">
                          {searchQuery ? highlightText(message.text || '', searchQuery) : message.text}
                          {message.edited && (
                            <span className="text-xs text-gray-400 ml-1">(edited)</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
              
              {/* Render attachments with per-media lock logic */}
              {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  {message.attachments.map((att, i) => {
                    if (att.locked && (!att.unlockedBy || !user?.uid || !att.unlockedBy.includes(user.uid))) {
                      return (
                        <div key={i} className="flex flex-col items-center justify-center min-h-[60px] relative">
                          <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center z-10">
                            <Lock className="w-8 h-8 text-gray-200 mb-2" />
                            <span className="text-xs text-gray-100 font-semibold mb-1">Locked. Unlock for ${att.price?.toFixed(2) ?? ''}</span>
                            <Button
                              className="mt-2 px-3 py-1 text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded shadow"
                              onClick={async () => {
                                // Simulate payment flow (replace with real payment integration)
                                const confirmed = window.confirm(`Pay $${att.price?.toFixed(2) ?? ''} to unlock this media?`);
                                if (!confirmed || !user?.uid) return;
                                // Find the message in Firestore and update the unlockedBy array for this attachment
                                try {
                                  const chatId = [user.uid, recipientId].sort().join('_');
                                  const messageRef = doc(db, 'chats', chatId, 'messages', message.id);
                                  const messageSnap = await getDoc(messageRef);
                                  if (!messageSnap.exists()) throw new Error('Message not found');
                                  const data = messageSnap.data();
                                  const updatedAttachments = (data.attachments || []).map((a: any, idx: number) => {
                                    if (idx === i) {
                                      return {
                                        ...a,
                                        unlockedBy: [...(a.unlockedBy || []), user.uid],
                                      };
                                    }
                                    return a;
                                  });
                                  await updateDoc(messageRef, { attachments: updatedAttachments });
                                  toast.success('Media unlocked!');
                                } catch (err) {
                                  toast.error('Failed to unlock media. Please try again.');
                                }
                              }}
                            >
                              UNLOCK
                            </Button>
                          </div>
                          {att.type === 'image' && (
                            <img
                              src={att.url}
                              alt="Locked image"
                              className="rounded-lg max-w-full max-h-[400px] mb-1 opacity-40"
                            />
                          )}
                          {att.type === 'video' && (
                            <video
                              className="rounded-lg max-w-full max-h-[400px] mb-1 opacity-40"
                              controls={false}
                              muted
                              preload="metadata"
                            >
                              <source src={att.url} type="video/mp4" />
                            </video>
                          )}
                        </div>
                      );
                    }
                    // Not locked or user is paid
                    if (att.type === 'image') {
                      return (
                        <div key={i} className="relative">
                          <img
                            src={att.url}
                    alt="Sent image" 
                    className="rounded-lg max-w-full max-h-[400px] mb-1 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setSelectedImage(att.url as string)}
                  />
                </div>
                      );
                    }
                    if (att.type === 'video') {
                      return (
                        <div key={i} className="relative group">
                  <div 
                    className="relative rounded-lg max-w-full max-h-[400px] mb-1 cursor-pointer overflow-hidden"
                            onClick={() => setSelectedVideo(att.url as string)}
                  >
                    <video 
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      onError={handleVideoError}
                      playsInline
                      preload="metadata"
                      muted
                      controls={false}
                    >
                              <source src={att.url} type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-12 w-12 bg-black/50 hover:bg-black/70 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                                  setSelectedVideo(att.url as string);
                        }}
                      >
                        <Play className="h-6 w-6" />
                      </Button>
                    </div>
                  </div>
                </div>
                      );
                    }
                    if (att.type === 'audio') {
                      const isReceived = message.senderId !== user?.uid;
                      return (
                        <div key={i} className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                            className={`h-8 w-8 ${playingAudio === message.id ? (isReceived ? 'text-black' : 'text-blue-500') : (isReceived ? 'text-black' : 'text-gray-500')}`}
                            onClick={() => handleAudioPlay(message.id, att.url as string)}
                  >
                    {playingAudio === message.id ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Mic className={`h-3 w-3 ${isReceived ? 'text-black' : 'text-white'}`} />
                      <span className={`text-sm ${isReceived ? 'text-black' : 'text-white'}`}>Voice message</span>
                    </div>
                    {playingAudio === message.id && (
                      <div className={`h-1 w-16 rounded-full overflow-hidden ${isReceived ? 'bg-gray-300' : 'bg-gray-200'}`}>
                        <div className={`h-full rounded-full animate-pulse ${isReceived ? 'bg-black' : 'bg-blue-500'}`} />
                      </div>
                    )}
                  </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
          </div>
                  </div>
                );
              })}
          </div>
        )}
        <div ref={messagesEndRef} />
        
      </div>
        ) : null}
        
        {/* Scroll to Bottom Button - Floating above chat */}
        {showScrollToBottom && !showGallery && (
          <div className="absolute bottom-16 right-4 z-20">
            <button
              onClick={() => {
                scrollToBottom();
                setShowScrollToBottom(false);
              }}
              className="bg-gray-200 border border-gray-300 rounded-full p-1 shadow-lg hover:bg-gray-300 transition-all duration-200"
              title="Scroll to bottom"
            >
              <ChevronDown className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        )}
      {/* Full-size Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={selectedImage}
              alt="Full size preview"
              className="max-w-full max-h-[90vh] object-contain"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
      )}

      {/* Full-size Video Preview Modal */}
      {selectedVideo && (
        <div 
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center"
          onClick={() => setSelectedVideo(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <video
              ref={videoRef}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
              onError={handleVideoError}
              preload="auto"
            >
              <source src={selectedVideo} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setSelectedVideo(null)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
      )}

      {/* Image Upload Preview Modal */}
      {showImageUpload && (
        <ImageUploadPreview
          onUpload={handleImageUpload}
          onCancel={() => setShowImageUpload(false)}
        />
      )}

      {/* Video Upload Preview Modal */}
      {showVideoUpload && (
        <VideoUploadPreview
          onUpload={handleVideoUpload}
          onCancel={() => setShowVideoUpload(false)}
        />
      )}


      {/* Voice Recorder Modal */}
      {showVoiceRecorder && !isBlocked && (
        <VoiceRecorder
          onUpload={handleVoiceUpload}
          onCancel={() => setShowVoiceRecorder(false)}
        />
      )}

      {/* Delete Message Confirmation Dialog */}
      <Dialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500">
                  Are you sure you want to delete this {messageToDelete?.type === 'audio' ? 'voice message' : messageToDelete?.type === 'image' ? 'image' : messageToDelete?.type === 'video' ? 'video' : 'message'}? This action cannot be undone.
                </p>
                <p className="text-xs text-red-500 mt-2">
                  Note: You can only delete messages that haven't been seen by the recipient.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              className="bg-white hover:bg-gray-50 border-gray-200"
              onClick={() => setMessageToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => messageToDelete && handleDeleteMessage(messageToDelete.id)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <form 
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSendMessage(e);
        }}
        onKeyDown={(e) => {
          // Prevent form submission on Enter if on mobile (to keep keyboard open)
          // This is handled by the Input's onKeyDown or the Send button
          if (e.key === 'Enter' && isMobile) {
            // Let the form handle it, but prevent default blur behavior
          }
        }}
        className={`p-1 md:p-2 bg-white/80 ${isMobile ? 'sticky bottom-0 left-0 right-0 z-40' : ''}`} 
        style={{ 
        backdropFilter: 'none !important',
        filter: 'none !important',
        boxShadow: 'none !important',
        touchAction: 'auto'
      }}>
        {/* File Preview Section */}
        {selectedFiles.length > 0 && (
          <div className="mb-2 p-2 bg-gray-50 rounded-lg">
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="relative group flex items-start gap-2">
                  {/* Thumbnail Preview */}
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                    {file.type === 'image' ? (
                      <img src={file.preview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    
                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(file.preview);
                        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                      }}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    
                    {/* Locked Indicator */}
                    {file.locked && (
                      <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1 rounded flex items-center gap-0.5">
                        <Lock className="h-2 w-2" />
                        ${file.price?.toFixed(2)}
                      </div>
                    )}
                  </div>
                  
                  {/* Locked Toggle (Verified Creators Only) */}
                  {isVerifiedCreator && (
                    <div 
                      className="flex flex-col gap-2 p-2"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 248, 255, 0.95) 100%)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '12px',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                        minWidth: '85px'
                      }}
                    >
                      <label className="flex items-center cursor-pointer text-[11px] font-semibold whitespace-nowrap text-gray-700">
                        <input
                          type="checkbox"
                          checked={file.locked}
                          onChange={(e) => {
                            const newFiles = [...selectedFiles];
                            newFiles[index] = { 
                              ...file, 
                              locked: e.target.checked,
                              price: e.target.checked ? (file.price || 0.99) : undefined
                            };
                            setSelectedFiles(newFiles);
                          }}
                          className="mr-1.5 w-4 h-4 cursor-pointer accent-blue-500 focus:outline-none focus:ring-0 focus:ring-offset-0"
                          style={{ outline: 'none', boxShadow: 'none' }}
                        />
                        Paid
                      </label>
                      
                      {/* Price Input */}
                      {file.locked && (
                        <input
                          type="number"
                          min="0.99"
                          step="0.01"
                          value={file.price || '0.99'}
                          onChange={(e) => {
                            const newFiles = [...selectedFiles];
                            newFiles[index] = { 
                              ...file, 
                              price: parseFloat(e.target.value) || 0.99
                            };
                            setSelectedFiles(newFiles);
                          }}
                          className="text-[11px] font-semibold text-gray-700 text-center"
                          style={{
                            background: 'rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(0, 0, 0, 0.1)',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                            padding: '4px 8px',
                            outline: 'none',
                            width: '100%'
                          }}
                          placeholder="0.99"
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex gap-1 md:gap-2 items-center">
          {/* Dropdown for Media & Emoji Buttons */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 md:h-8 md:w-8 text-blue-400 hover:text-blue-400 hover:bg-transparent" disabled={isBlocked || !canChat}>
                <Plus className="h-5 w-5" strokeWidth={3} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-white p-2">
              <DropdownMenuItem onClick={handleImageClick} className="flex items-center gap-2" disabled={isBlocked || !canChat}>
                <ImageIcon className="h-4 w-4 text-blue-400" /> Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleVideoClick} className="flex items-center gap-2" disabled={isBlocked || !canChat}>
                <Video className="h-4 w-4 text-blue-400" /> Video
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Video upload input */}
          <input
            type="file"
            accept="video/*"
            ref={videoInputRef}
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              handleVideoUpload(files.map(file => ({ file, locked: false })));
            }}
            style={{ display: 'none' }}
            disabled={uploading || isBlocked}
          />
          {/* Message Input */}
          <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
            {/* Chat Locked Overlay */}
            {!canChat && !isBlocked && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-[20px] shadow-lg">
                <div className="flex items-center justify-center gap-2 font-medium -ml-4">
                  <Lock className="h-4 w-4 bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent" />
                  <span className="bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">
                    This chat is for subscribers only
                  </span>
                </div>
              </div>
            )}
            
            <Input
              ref={messageInputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onBlur={(e) => {
                // On mobile, prevent keyboard from closing by refocusing immediately
                // Only if user is still in chat view (not navigating away)
                if (isMobile && !uploading && !isRecording) {
                  // Small delay to check if blur was intentional (e.g., user tapped outside)
                  const target = e.relatedTarget as HTMLElement | null;
                  // Don't refocus if user clicked on a button or interactive element
                  if (!target || (!target.closest('button') && !target.closest('[role="button"]'))) {
                    setTimeout(() => {
                      if (messageInputRef.current && document.activeElement !== messageInputRef.current) {
                        // Only refocus if we're still in the chat and input is available
                        const chatContainer = messageInputRef.current.closest('.chat-container, [class*="chat"]');
                        if (chatContainer) {
                          messageInputRef.current.focus();
                        }
                      }
                    }, 50);
                  }
                }
              }}
              onFocus={(e) => {
                // Ensure input scrolls into view on mobile when focused
                if (isMobile) {
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                }
              }}
              placeholder={
                isBlocked 
                  ? "You cannot send messages to this user" 
                  : !canChat 
                    ? "Subscribe to chat with this creator" 
                    : "Aa"
              }
              className="w-full chat-message-input text-black placeholder:text-gray-400 bg-gray-100 focus:ring-0 focus:border-0 px-4 pr-12 shadow-sm"
              style={{
                height: '40px',
                minHeight: '40px',
                maxHeight: '40px',
                fontSize: '16px',
                lineHeight: '1.5',
                border: 'none !important',
                outline: 'none !important',
                backgroundColor: '#f3f4f6 !important',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1) !important',
                borderRadius: '20px !important',
                touchAction: 'auto'
              }}
              disabled={uploading || isRecording || isBlocked || !canChat}
            />
            
            {/* Emoji Button Inside Input */}
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    type="button" 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6 text-gray-400 hover:text-gray-400 hover:bg-transparent p-0" 
                    disabled={isBlocked || !canChat}
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
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
                      // Faces & Emotions
                      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃',
                      // Animals
                      '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦏', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔',
                      // Hearts & Love
                      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟',
                      // Symbols & Signs
                      '🔢', '🔠', '🔡', '🔤', '🅰️', '🆎', '🅱️', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓',
                      // Food & Drinks
                      '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫒', '🌽', '🥕', '🫑', '🥔', '🍠', '🥐', '🥖', '🍞', '🥨', '🥯', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥙', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🫖', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾',
                      // Activities & Sports
                      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️‍♀️', '🏋️', '🏋️‍♂️', '🤼‍♀️', '🤼', '🤼‍♂️', '🤸‍♀️', '🤸', '🤸‍♂️', '⛹️‍♀️', '⛹️', '⛹️‍♂️', '🤺', '🤾‍♀️', '🤾', '🤾‍♂️', '🏌️‍♀️', '🏌️', '🏌️‍♂️', '🏇', '🧘‍♀️', '🧘', '🧘‍♂️', '🏄‍♀️', '🏄', '🏄‍♂️', '🏊‍♀️', '🏊', '🏊‍♂️', '🤽‍♀️', '🤽', '🤽‍♂️', '🚣‍♀️', '🚣', '🚣‍♂️', '🧗‍♀️', '🧗', '🧗‍♂️', '🚵‍♀️', '🚵', '🚵‍♂️', '🚴‍♀️', '🚴', '🚴‍♂️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🤹‍♀️', '🤹‍♂️', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🪘', '🥁', '🪗', '🎸', '🪕', '🎺', '🎷', '🪗', '🎻', '🪈', '🎲', '♠️', '♥️', '♦️', '♣️', '🃏', '🀄', '🎴', '🎯', '🎳', '🎮', '🎰', '🧩', '🎲'
                    ].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setNewMessage(prev => prev + emoji);
                        }}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-md text-lg"
                        disabled={isBlocked}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {editingMessage ? (
            <div className="flex items-center gap-1.5">
              {/* Cancel button (X) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelEdit();
                }}
                className="flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer'
                }}
              >
                <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
              {/* Save button (✓) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEditMessage();
                }}
                disabled={!newMessage.trim()}
                className="flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: newMessage.trim() ? '#2389FF' : '#9ca3af',
                  cursor: newMessage.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            </div>
          ) : (newMessage.trim() || selectedFiles.length > 0) ? (
            <Button 
              type="submit" 
              size="icon" 
              className="h-6 w-6 md:h-7 md:w-7 rounded-full border-none focus:outline-none send-button-animated" 
              style={{
                backgroundColor: '#2389FF',
                background: '#2389FF',
                color: 'white',
                border: 'none',
                transition: 'all 0.5s ease-in-out',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (e.currentTarget) {
                  e.currentTarget.style.borderRadius = '50%';
                  e.currentTarget.style.transition = 'all 0.5s ease-in-out';
                  e.currentTarget.style.backgroundColor = '#2389FF';
                }
              }}
              onMouseLeave={(e) => {
                if (e.currentTarget) {
                  e.currentTarget.style.borderRadius = '50%';
                  e.currentTarget.style.transition = 'all 0.5s ease-in-out';
                  e.currentTarget.style.backgroundColor = '#2389FF';
                }
              }}
              disabled={uploading || isBlocked || !canChat}
            >
              <Send className="h-2 w-2 md:h-3 md:w-3" style={{ opacity: 0 }} />
            </Button>
          ) : (
            <div className="relative" style={{
              boxShadow: 'none !important',
              filter: 'none !important',
              backdropFilter: 'none !important',
              animation: 'none !important'
            }}>
              {!isRecording ? (
                <div style={{
                  boxShadow: 'none !important',
                  filter: 'none !important',
                  backdropFilter: 'none !important',
                  animation: 'none !important',
                  isolation: 'isolate'
                }}>
                <Button
                  type="button"
                  size="icon"
                    className="microphone-button bg-white text-[#2B55FF] h-8 w-8 md:h-9 md:w-9 hover:bg-[#6B3BFF]/10 focus:outline-none"
                    style={{ 
                      boxShadow: 'none !important',
                      animation: 'none !important',
                      WebkitAnimation: 'none !important',
                      MozAnimation: 'none !important',
                      OAnimation: 'none !important',
                      MsAnimation: 'none !important',
                      filter: 'none !important',
                      backdropFilter: 'none !important',
                      outline: 'none !important',
                      textShadow: 'none !important',
                      isolation: 'isolate'
                    } as any}
                  onClick={startRecording}
                  disabled={uploading || isBlocked || !canChat}
                >
                  <Mic className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="icon"
                    className="microphone-button rounded-full bg-white text-[#2B55FF] h-8 w-8 md:h-9 md:w-9 hover:bg-[#6B3BFF]/10 focus:outline-none"
                    style={{ 
                      backgroundColor: '#ffffff !important',
                      color: '#3b82f6 !important',
                      boxShadow: 'none !important',
                      animation: 'none !important',
                      WebkitAnimation: 'none !important',
                      MozAnimation: 'none !important',
                      OAnimation: 'none !important',
                      MsAnimation: 'none !important',
                      filter: 'none !important',
                      backdropFilter: 'none !important',
                      outline: 'none !important',
                      textShadow: 'none !important',
                      border: 'none !important'
                    } as any}
                    onClick={cancelRecording}
                  >
                    <X className="h-3 w-3 md:h-4 md:w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    className="microphone-button rounded-full bg-white text-[#2B55FF] h-8 w-8 md:h-9 md:w-9 hover:bg-[#6B3BFF]/10 focus:outline-none"
                    style={{ 
                      backgroundColor: '#ffffff !important',
                      color: '#3b82f6 !important',
                      boxShadow: 'none !important',
                      animation: 'none !important',
                      WebkitAnimation: 'none !important',
                      MozAnimation: 'none !important',
                      OAnimation: 'none !important',
                      MsAnimation: 'none !important',
                      filter: 'none !important',
                      backdropFilter: 'none !important',
                      outline: 'none !important',
                      textShadow: 'none !important',
                      border: 'none !important'
                    } as any}
                    onClick={stopRecording}
                  >
                    <Send className="h-3 w-3 md:h-4 md:w-4" />
                  </Button>
                  <div className="flex items-center px-2 bg-white/90 rounded-lg">
                    <span className="text-sm text-gray-700">{formatDuration(recordingDuration)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
      
    </div>
  );
}