import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, getDocs, doc, setDoc, updateDoc, getDoc, DocumentData, deleteDoc, Timestamp, writeBatch, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { MessagesAvatar } from '@/components/ui/MessagesAvatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Image as ImageIcon, Video, Smile, Mic, MicOff, Plus, X, Play, Lock, Pause, Trash2, Edit, MoreVertical, UserX } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
// Firebase Storage imports removed - now using AWS S3
import { ImageUploadPreview } from './ImageUploadPreview';
import { toast } from 'sonner';
import { VideoUploadPreview } from './VideoUploadPreview';
import { EmojiPicker } from './EmojiPicker';
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
  attachments?: MessageAttachment[];
  edited?: boolean;
  isWelcomeMessage?: boolean;
}

interface ChatProps {
  recipientId: string;
  recipientName: string;
  hideHeader?: boolean;
  customWidth?: number;
}

// Add this function before the Chat component
const ensureChatDocument = async (user: any, recipientId: string) => {
  const chatId = [user.uid, recipientId].sort().join('_');
  const chatRef = doc(db, 'chats', chatId);
  const chatDoc = await getDoc(chatRef);

  if (!chatDoc.exists()) {
    await setDoc(chatRef, {
      participants: [user.uid, recipientId],
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      unreadCounts: {
        [user.uid]: 0,
        [recipientId]: 0
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  return chatId;
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

export function Chat({ recipientId, recipientName, hideHeader = false, customWidth }: ChatProps) {
  const { user } = useAuth();
  const [isBlocked, setIsBlocked] = useState(false);
  const [checkingBlock, setCheckingBlock] = useState(true);

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
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<{ id: string; type: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ file: File; preview: string; type: 'image' | 'video'; locked: boolean; price?: number }>>([]);
  const [isVerifiedCreator, setIsVerifiedCreator] = useState(false);
  const [verifiedCreators, setVerifiedCreators] = useState<Record<string, boolean>>({});
  const [editText, setEditText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
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
  const [recipientProfile, setRecipientProfile] = useState<{ displayName: string; username: string; photoURL?: string } | null>(null);
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

    // Create a unique chat ID based on user IDs (sorted to ensure consistency)
    const chatId = [user.uid, recipientId].sort().join('_');
    
    // Ensure chat document exists (it should already be created by openChat)
    const ensureChatDocument = async () => {
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          participants: [user.uid, recipientId],
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          unreadCounts: {
            [user.uid]: 0,
            [recipientId]: 0
          },
          typing: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log('Chat document created in Chat component:', chatId);
      }
    };
    
    ensureChatDocument().catch(error => {
      console.error('Error ensuring chat document:', error);
    });

    // Mark all unread messages from the recipient as read
    const markMessagesAsRead = async () => {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
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
    };
    markMessagesAsRead();

    // Listen to messages with real-time updates
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      // Reverse to show oldest first (chronological order)
      setMessages(newMessages.reverse());

      // Update message status to 'delivered' for new messages
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const messageData = change.doc.data();
          if (messageData.senderId === user.uid && messageData.status === 'sent') {
            // Update to delivered after a short delay
            setTimeout(async () => {
              const messageRef = doc(db, 'chats', chatId, 'messages', change.doc.id);
              await updateDoc(messageRef, { status: 'delivered' });
            }, 1000);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user, recipientId]);

  useEffect(() => {
    if (!recipientId) return;
    const fetchProfile = async () => {
      const userDoc = await getDoc(doc(db, 'users', recipientId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setRecipientProfile({
          displayName: data.displayName || data.username || recipientName,
          username: data.username || recipientId,
          photoURL: data.photoURL || undefined,
        });
      } else {
        setRecipientProfile({ displayName: recipientName, username: recipientId });
      }
    };
    fetchProfile();
  }, [recipientId, recipientName]);

  useEffect(() => {
    if (!recipientId) return;
    const userRef = doc(db, 'users', recipientId);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      const data = docSnap.data();
      setRecipientStatus({
        online: data?.online,
        lastSeen: data?.lastSeen,
      });
      if (data) {
        setRecipientProfile((prev) => prev ? { ...prev, ...data } : {
          displayName: data.displayName || recipientName,
          username: data.username || recipientId,
          photoURL: data.photoURL || undefined,
        });
      }
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
    if (messagesEndRef.current) {
      // Force immediate scroll to bottom like WhatsApp
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'auto', // Changed from 'smooth' to 'auto' for immediate scroll
        block: 'end',
        inline: 'nearest'
      });
      
      // Also try scrolling the container directly
      const container = messagesEndRef.current.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
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

    setUploading(true);
    
    try {
      // Separate images and videos
      const images = selectedFiles.filter(f => f.type === 'image');
      const videos = selectedFiles.filter(f => f.type === 'video');
      
      // Get the text message to attach as caption
      const captionText = newMessage.trim();
      
      // Upload images with caption
      if (images.length > 0) {
        await handleImageUpload(images.map(({ file, locked, price }) => ({ file, locked, price })), captionText);
      }
      
      // Upload videos with caption
      if (videos.length > 0) {
        await handleVideoUpload(videos.map(({ file, locked, price }) => ({ file, locked, price })), captionText);
      }
      
      // Clear text message and selected files
      setNewMessage('');
      selectedFiles.forEach(f => URL.revokeObjectURL(f.preview));
      setSelectedFiles([]);
    } catch (error) {
      console.error('Error sending files:', error);
      toast.error('Failed to send files');
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If there are selected files, send them with caption text
    if (selectedFiles.length > 0) {
      await handleSendFiles();
      return; // Don't send separate text message
    }
    
    // If no files, send text message only
    if (!newMessage.trim()) return;
    
    if (user) {
      const chatId = [user.uid, recipientId].sort().join('_');
      const messagesRef = collection(db, 'chats', chatId, 'messages');

      const messageData = {
        text: newMessage,
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Anonymous',
        timestamp: serverTimestamp(),
        read: false,
        status: 'sent',
        type: 'text'
      };

      await addDoc(messagesRef, messageData);
      
      // Update chat metadata with last message
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: newMessage.trim(),
        lastMessageTime: serverTimestamp(),
        unreadCounts: {
          [recipientId]: (await getDoc(chatRef)).data()?.unreadCounts?.[recipientId] + 1 || 1
        }
      });
      
      
      // Force refresh chat metadata by querying the actual last message
      setTimeout(async () => {
        try {
          await updateChatMetadataFromActualLastMessage(chatId);
        } catch (error) {
          console.error('Error refreshing chat metadata:', error);
        }
      }, 500);
      
      setNewMessage('');
    }
    
    // Scroll to bottom after sending message
    setTimeout(() => scrollToBottom(), 100);
    setTimeout(() => scrollToBottom(), 300);
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
      await ensureChatDocument(user, recipientId);
      const chatId = [user.uid, recipientId].sort().join('_');
      const messagesRef = collection(db, 'chats', chatId, 'messages');

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
          const url = await uploadChatMedia(file, chatId);
          
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
          
          await addDoc(messagesRef, messageData);
          
          // Update chat metadata
          const chatRef = doc(db, 'chats', chatId);
          await updateDoc(chatRef, {
            lastMessage: '📷 Image',
            lastMessageTime: serverTimestamp(),
            unreadCounts: {
              [recipientId]: (await getDoc(chatRef)).data()?.unreadCounts?.[recipientId] + 1 || 1
            }
          });
          
          // Force refresh to ensure accuracy
          setTimeout(() => {
            updateChatMetadataFromActualLastMessage(chatId);
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
      await ensureChatDocument(user, recipientId);
      const chatId = [user.uid, recipientId].sort().join('_');
      const messagesRef = collection(db, 'chats', chatId, 'messages');

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
          const url = await uploadChatMedia(file, chatId);
          
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
          
          await addDoc(messagesRef, messageData);
          
          // Update chat metadata
          const chatRef = doc(db, 'chats', chatId);
          await updateDoc(chatRef, {
            lastMessage: '🎥 Video',
            lastMessageTime: serverTimestamp(),
            unreadCounts: {
              [recipientId]: (await getDoc(chatRef)).data()?.unreadCounts?.[recipientId] + 1 || 1
            }
          });
          
          // Force refresh to ensure accuracy
          setTimeout(() => {
            updateChatMetadataFromActualLastMessage(chatId);
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
      await ensureChatDocument(user, recipientId);
      const chatId = [user.uid, recipientId].sort().join('_');
      const messagesRef = collection(db, 'chats', chatId, 'messages');

      // Upload audio file to AWS S3
      const { uploadAudio } = await import('@/lib/aws/upload');
      const url = await uploadAudio(audioBlob);
      
      // Create message with duration
      await addDoc(messagesRef, {
        text: '',
        audioUrl: url,
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous',
        senderPhotoURL: user.photoURL || '',
        timestamp: serverTimestamp(),
        read: false,
        type: 'audio',
        duration: recordingDuration // Add the duration to the message
      });

      // Update chat metadata with last message
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: '🎵 Voice message',
        lastMessageTime: serverTimestamp(),
        unreadCounts: {
          [recipientId]: (await getDoc(chatRef)).data()?.unreadCounts?.[recipientId] + 1 || 1
        }
      });
      
      // Force refresh to ensure accuracy
      setTimeout(() => {
        updateChatMetadataFromActualLastMessage(chatId);
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
  const updateChatMetadataFromActualLastMessage = async (chatId: string) => {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
      const lastMessageSnapshot = await getDocs(messagesQuery);
      
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
        
      }
    } catch (error) {
      console.error('Error updating chat metadata from actual last message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user) return;

    try {
      const chatId = [user.uid, recipientId].sort().join('_');
      const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
      
      // Get message data to check if it's been read
      const messageDoc = await getDoc(messageRef);
      const messageData = messageDoc.data();
      
      if (!messageData) {
        toast.error('Message not found');
        return;
      }
      
      // Check if message has been read by recipient
      if (messageData.read && messageData.senderId === user.uid) {
        toast.error('Cannot delete message that has been seen');
        return;
      }
      
      await deleteDoc(messageRef);
      
      // Wait a moment for the deletion to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Update chat metadata by querying the actual last message
      await updateChatMetadataFromActualLastMessage(chatId);
      
      toast.success("Message deleted successfully");
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error("Failed to delete the message. Please try again.");
    } finally {
      setMessageToDelete(null);
    }
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !editText.trim() || !user) return;

    try {
      const chatId = [user.uid, recipientId].sort().join('_');
      const messageRef = doc(db, 'chats', chatId, 'messages', editingMessage.id);
      
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
        return;
      }
      
      await updateDoc(messageRef, {
        text: editText.trim(),
        edited: true,
        editedAt: serverTimestamp()
      });
      
      // Update chat metadata if this is the last message
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: editText.trim(),
        lastMessageTime: serverTimestamp()
      });
      
      setEditingMessage(null);
      setEditText('');
      toast.success('Message edited');
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Failed to edit message');
    }
  };

  const startEditMessage = (messageId: string, currentText: string) => {
    setEditingMessage({ id: messageId, text: currentText });
    setEditText(currentText);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
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
    <div className="flex flex-col h-full w-full relative chat-container" style={{ width: '100%' }}>
      {/* Chat Title Bar */}
      {!hideHeader && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 sticky top-0 z-10 bg-white/80 backdrop-blur-lg"
             style={{ borderColor: themeColors.brand.blue.deep }}>
          <div
            className="flex items-center gap-3 cursor-pointer hover:underline"
            onClick={() => router.push(`/${recipientProfile?.username || recipientId}`)}
          >
            <div className="relative flex-shrink-0 w-12 h-12">
              <MessagesAvatar 
                src={recipientProfile?.photoURL || '/default-avatar.png'}
                alt={recipientProfile?.displayName || recipientName}
                fallback={(recipientProfile?.displayName || recipientName)?.[0] || '?'}
                size="md"
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
          {/* Open in Popup Icon Button */}
            <button
              className="ml-auto p-1.5 rounded-full shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                backgroundColor: '#0F77FF',
                color: 'white'
              }}
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Separator Line */}
      <div className="border-b border-gray-200"></div>
      
      {/* Messages Container */}
          <div 
            className="flex-1 overflow-y-auto px-2 py-4 bg-white border-r border-gray-200 scrollbar-hide flex flex-col justify-start chat-messages-container" 
            style={{ 
              scrollBehavior: 'smooth', 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'stretch',
              height: '100%',
              minHeight: '0',
              overflowY: 'auto',
              width: '100%'
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
                  gap: '0.1rem'
                }}
              >
        {messages.map((message, idx) => (
          <div
            key={message.id}
              className={`flex w-full chat-message-item ${message.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
            >
            {/* Render image message without frame */}
            {message.type === 'image' && message.imageUrl ? (
              <div className={`flex items-center gap-2 group ${message.senderId === user?.uid ? 'justify-end' : 'justify-start'}`} style={{ maxWidth: '80%' }}>
                {/* Message actions for image - on white background (left side) */}
                {message.senderId === user?.uid && !message.read && (
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
                
                <div className="relative">
                  {/* Check if image is locked and user is receiver */}
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
                        <div style={{
                          padding: '8px 12px',
                          fontSize: '14px',
                          color: '#1a1a1a',
                          lineHeight: '1.5'
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
                        <div style={{
                          padding: '8px 12px',
                          fontSize: '14px',
                          color: '#1a1a1a',
                          lineHeight: '1.5'
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
              </div>
            ) : message.type === 'video' && message.videoUrl ? (
              <div className={`flex items-center gap-2 group ${message.senderId === user?.uid ? 'justify-end' : 'justify-start'}`} style={{ maxWidth: '80%' }}>
                {/* Message actions for video - on white background (left side) */}
                {message.senderId === user?.uid && !message.read && (
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
                
                <div className="relative">
                  {/* Check if video is locked and user is receiver */}
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
                        <div style={{
                          padding: '8px 12px',
                          fontSize: '14px',
                          color: '#1a1a1a',
                          lineHeight: '1.5'
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
                        <div style={{
                          padding: '8px 12px',
                          fontSize: '14px',
                          color: '#1a1a1a',
                          lineHeight: '1.5'
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
              </div>
            ) : message.type === 'audio' && message.audioUrl ? (
              <div className={`flex items-center gap-2 group ${message.senderId === user?.uid ? 'justify-end' : 'justify-start'}`} style={{ maxWidth: '80%' }}>
                {/* Message actions for voice - on white background (left side) */}
                {message.senderId === user?.uid && !message.read && (
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
                
                <div className={`relative rounded-2xl p-3 border shadow chat-message-bubble ${
                  message.senderId === user?.uid 
                    ? 'text-white shadow-sm'
                    : 'bg-gray-100 text-black border-gray-100 shadow-sm'
                }`} style={{
                  ...(message.senderId === user?.uid ? { backgroundColor: '#0F77FF', borderColor: '#0F77FF' } : {}),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  minWidth: 'fit-content'
                }}>
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
                
                <div className={`relative rounded-2xl p-3 border shadow chat-message-bubble ${
                  message.senderId === user?.uid 
                    ? 'text-white shadow-sm'
                    : 'bg-gray-100 text-black border-gray-100 shadow-sm'
                }`} style={{
                  ...(message.senderId === user?.uid ? { backgroundColor: '#0F77FF', borderColor: '#0F77FF' } : {}),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  minWidth: 'fit-content'
                }}>
                  {/* Text content - editable if not read */}
                  {editingMessage?.id === message.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full p-2 text-xs md:text-sm bg-white text-black rounded border resize-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleEditMessage}
                          className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-left">
                      {/* Welcome message with image support */}
                      {message.isWelcomeMessage && message.imageUrl ? (
                        <div className="space-y-2">
                          <img
                            src={message.imageUrl}
                            alt="Welcome image"
                            className="w-full max-w-sm h-48 object-cover rounded-lg border border-gray-200"
                          />
                          <p className="text-xs md:text-sm break-words whitespace-normal">
                            {message.text}
                            {message.edited && (
                              <span className="text-xs text-gray-400 ml-1">(edited)</span>
                            )}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs md:text-sm break-words whitespace-normal">
                          {message.text}
                          {message.edited && (
                            <span className="text-xs text-gray-400 ml-1">(edited)</span>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
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
                              Unlock
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
        ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

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

      {/* Emoji Picker Modal */}
      {showEmojiPicker && !isBlocked && (
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
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

      <form onSubmit={handleSendMessage} className="p-1 md:p-2 border-t bg-white/80" style={{ 
        borderColor: themeColors.brand.blue.deep,
        backdropFilter: 'none !important',
        filter: 'none !important',
        boxShadow: 'none !important'
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
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 md:h-8 md:w-8 text-blue-400" disabled={isBlocked}>
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-white">
              <DropdownMenuItem onClick={handleImageClick} className="flex items-center gap-2" disabled={isBlocked}>
                <ImageIcon className="h-4 w-4 text-blue-400" /> Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleVideoClick} className="flex items-center gap-2" disabled={isBlocked}>
                <Video className="h-4 w-4 text-blue-400" /> Video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowEmojiPicker(true)} className="flex items-center gap-2" disabled={isBlocked}>
                <Smile className="h-4 w-4 text-yellow-500" /> Emoji
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
          <div style={{ flex: 1, display: 'flex' }}>
            <Input
              ref={messageInputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isBlocked ? "You cannot send messages to this user" : "Type a message..."}
              className="w-full chat-message-input text-[#1A1A1A] placeholder:text-blue-400 bg-white/90 border border-blue-200 focus:ring-2 focus:ring-[#6B3BFF] focus:border-[#2B55FF] rounded-xl px-4"
              style={{
                height: '40px',
                minHeight: '40px',
                maxHeight: '40px',
                fontSize: '14px',
                lineHeight: '1.5',
              }}
              disabled={uploading || isRecording || isBlocked}
            />
          </div>
          {(newMessage.trim() || selectedFiles.length > 0) ? (
            <Button type="submit" size="icon" className="bg-white text-[#2B55FF] h-7 w-7 md:h-8 md:w-8 shadow hover:bg-[#6B3BFF]/10 focus:outline-none border border-blue-200" disabled={uploading || isBlocked}>
              <Send className="h-3 w-3 md:h-4 md:w-4" />
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
                    className="microphone-button bg-white text-[#2B55FF] h-7 w-7 md:h-8 md:w-8 hover:bg-[#6B3BFF]/10 focus:outline-none"
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
                  disabled={uploading || isBlocked}
                >
                  <Mic className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="icon"
                    className="microphone-button rounded-full bg-white text-[#2B55FF] h-7 w-7 md:h-8 md:w-8 hover:bg-[#6B3BFF]/10 focus:outline-none"
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
                    className="microphone-button rounded-full bg-white text-[#2B55FF] h-7 w-7 md:h-8 md:w-8 hover:bg-[#6B3BFF]/10 focus:outline-none"
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