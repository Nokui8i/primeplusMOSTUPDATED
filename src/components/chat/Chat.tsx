import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, getDocs, doc, setDoc, updateDoc, getDoc, DocumentData, deleteDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { MessagesAvatar } from '@/components/ui/MessagesAvatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Image as ImageIcon, Video, Smile, Mic, MicOff, Plus, X, Play, Lock, Pause, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
// Firebase Storage imports removed - now using AWS S3
import { ImageUploadPreview } from './ImageUploadPreview';
import { toast } from 'sonner';
import { VideoUploadPreview } from './VideoUploadPreview';
import { EmojiPicker } from './EmojiPicker';
import { VoiceRecorder } from './VoiceRecorder';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { useChat } from '@/contexts/ChatContext';
import { FiMessageSquare } from 'react-icons/fi';
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
  attachments?: MessageAttachment[];
}

interface ChatProps {
  recipientId: string;
  recipientName: string;
  hideHeader?: boolean;
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

export function Chat({ recipientId, recipientName, hideHeader = false }: ChatProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { openChat } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<{ id: string; type: string } | null>(null);
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
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [shouldCancel, setShouldCancel] = useState(false);
  const [slidePosition, setSlidePosition] = useState(0);
  const [recipientProfile, setRecipientProfile] = useState<{ displayName: string; username: string; photoURL?: string } | null>(null);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const TYPING_TIMEOUT = 3000; // 3 seconds
  const [recipientStatus, setRecipientStatus] = useState<{ online?: boolean; lastSeen?: any }>({});
  const [userPlanType, setUserPlanType] = useState<'Free' | 'Paid' | null>(null);

  useEffect(() => {
    if (!user) return;

    // Create a unique chat ID based on user IDs (sorted to ensure consistency)
    const chatId = [user.uid, recipientId].sort().join('_');
    
    // Create or update chat document
    const chatRef = doc(db, 'chats', chatId);
    setDoc(chatRef, {
      participants: [user.uid, recipientId],
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(error => {
      console.error('Error creating chat:', error);
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
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(newMessages);

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

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
    setNewMessage('');
  };

  const handleImageClick = () => {
    setShowImageUpload(true);
  };

  const handleImageUpload = async (files: { file: File, locked: boolean }[]) => {
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
      for (const { file, locked } of files) {
        try {
          // Import AWS upload function
          const { uploadChatMedia } = await import('@/lib/aws/upload');
          const url = await uploadChatMedia(file, chatId);
          
          await addDoc(messagesRef, {
            text: '',
            imageUrl: url,
            senderId: user.uid,
            senderName,
            senderPhotoURL,
            timestamp: serverTimestamp(),
            read: false,
            type: 'image',
            locked: !!locked,
          });
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
    setShowVideoUpload(true);
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const videoElement = e.target as HTMLVideoElement;
    
    // Log error details for debugging
    console.error('Video error details:', {
      error: videoElement.error ? {
        code: videoElement.error.code,
        message: videoElement.error.message
      } : 'No error object',
      networkState: videoElement.networkState,
      readyState: videoElement.readyState,
      src: videoElement.currentSrc || videoElement.src,
      duration: videoElement.duration || 0,
      paused: videoElement.paused,
      ended: videoElement.ended,
      muted: videoElement.muted,
      volume: videoElement.volume
    });

    // Try to reload the video with the correct Firebase Storage URL format
    if (videoElement && videoElement.currentSrc) {
      const currentSrc = videoElement.currentSrc;
      // Ensure we have the correct Firebase Storage URL format
      const baseUrl = currentSrc.split('?')[0]; // Remove query parameters
      const token = currentSrc.match(/token=([^&]+)/)?.[1] || '';
      
      // Create new source elements with proper Firebase Storage URL format
      const source = document.createElement('source');
      source.src = `${baseUrl}?alt=media&token=${token}`;
      source.type = 'video/mp4';

      // Clear existing sources
      while (videoElement.firstChild) {
        videoElement.removeChild(videoElement.firstChild);
      }

      // Add new source
      videoElement.appendChild(source);

      // Reload the video
      videoElement.load();
    }

    toast.error('Error loading video. Please try again.');
  };

  // Handle video upload
  const handleVideoUpload = async (files: { file: File, locked: boolean }[]) => {
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
      for (const { file, locked } of files) {
        try {
          // Import AWS upload function
          const { uploadChatMedia } = await import('@/lib/aws/upload');
          const url = await uploadChatMedia(file, chatId);
          
          await addDoc(messagesRef, {
            text: '',
            videoUrl: url,
            senderId: user.uid,
            senderName,
            senderPhotoURL,
            timestamp: serverTimestamp(),
            read: false,
            type: 'video',
            locked: !!locked,
          });
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
        };
        
        audio.onerror = handleAudioError;
      }

      if (playingAudio === messageId) {
        // If this audio is already playing, stop it
        audio.pause();
        audio.currentTime = 0;
        setPlayingAudio(null);
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

      console.log('Voice message uploaded successfully:', url);
    } catch (error) {
      console.error('Error uploading voice message:', error);
      toast.error('Failed to upload voice message');
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        console.log('Recording stopped, blob size:', audioBlob.size);
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

  const handleDeleteMessage = async (messageId: string) => {
    if (!user) return;

    try {
      const chatId = [user.uid, recipientId].sort().join('_');
      const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
      await deleteDoc(messageRef);
      
      toast.success("Message deleted successfully");
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error("Failed to delete the message. Please try again.");
    } finally {
      setMessageToDelete(null);
    }
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
    setDoc(chatRef, { typing: isTyping ? user.uid : null }, { merge: true });
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

  return (
    <div className="flex flex-col h-full">
      {/* Chat Title Bar */}
      {!hideHeader && recipientProfile && (
        <div className="flex items-center gap-3 px-4 py-2 border-b sticky top-0 z-10 bg-white/80 backdrop-blur-lg" /* PADDING: gap-3 px-4 py-2 */
             style={{ borderColor: themeColors.brand.blue.deep }}>
          <div
            className="flex items-center gap-3 cursor-pointer hover:underline" /* PADDING: gap-3 - increased spacing */
            onClick={() => router.push(`/${recipientProfile.username}`)}
          >
            <div className="relative flex-shrink-0 w-12 h-12"> {/* PADDING: w-12 h-12 (48px) - exact avatar size */}
              <MessagesAvatar 
                src={recipientProfile.photoURL || '/default-avatar.png'}
                alt={recipientProfile.displayName}
                fallback={recipientProfile.displayName?.[0] || '?'}
                size="md"
              />
            </div>
            <span className="font-semibold text-base" style={{ color: themeColors.brand.blue.deep }}>{recipientProfile.displayName}</span>
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
            {recipientStatus.online ? (
              <span className="text-xs text-green-500 font-semibold">Online</span>
            ) : (
              <span className="text-xs text-gray-400">Last seen: {recipientStatus.lastSeen ? formatDistanceToNow(recipientStatus.lastSeen.toDate(), { addSuffix: true }) : 'Unknown'}</span>
            )}
          </div>
          {/* Open in Popup Icon Button */}
          <button
            className="ml-auto p-1.5 rounded-full shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              background: 'linear-gradient(135deg, #2B1B5A 0%, #6B3BFF 60%, #FF8DC7 100%)',
              color: themeColors.text.primary,
              boxShadow: '0 4px 24px 0 rgba(107,59,255,0.25), 0 0 0 4px rgba(107,59,255,0.10)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: 'none',
              position: 'relative',
              overflow: 'hidden',
              zIndex: 1,
              backgroundImage: 'linear-gradient(135deg, #2B1B5A 0%, #6B3BFF 60%, #FF8DC7 100%), radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 80%, transparent 100%)',
            }}
            onMouseOver={e => {
              e.currentTarget.style.filter = 'brightness(1.08) scale(1.08)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.filter = '';
            }}
            onClick={() => openChat({
              id: recipientId,
              uid: recipientId,
              displayName: recipientProfile.displayName,
              username: recipientProfile.username,
              photoURL: recipientProfile.photoURL || '',
              email: '',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              isAgeVerified: false,
              isVerified: false,
              role: 'user',
              status: 'active'
            })}
            title="Open in chat popup"
            aria-label="Open in chat popup"
            type="button"
          >
            <FiMessageSquare className="w-4 h-4 drop-shadow-[0_2px_8px_rgba(43,85,255,0.5)]" />
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-1 md:p-2 space-y-1 md:space-y-2">
        {messages.map((message, idx) => (
          <div
            key={message.id}
            className={`flex w-full ${message.senderId === user?.uid ? 'justify-start' : 'justify-end'}`}
          >
            <div className={`relative group max-w-[95%] md:max-w-[85%] rounded-xl p-1.5 md:p-2 border shadow ${
              message.senderId === user?.uid 
                ? 'bg-gradient-to-br from-white via-[#6B3BFF]/20 to-[#2B55FF]/20 text-[#1A1A1A] border-[#6B3BFF] shadow-blue-100'
                : 'bg-white/70 border-blue-200 text-[#1A1A1A] shadow-blue-100'
            }`}>
              {/* Always show text */}
              <p className="text-xs md:text-sm break-words">{message.text}</p>
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
                      return (
                        <div key={i} className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                            className={`h-8 w-8 ${playingAudio === message.id ? 'text-blue-500' : 'text-gray-500'}`}
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
                      <Mic className="h-3 w-3 text-gray-500" />
                      <span className="text-sm text-gray-500">Voice message</span>
                    </div>
                    {playingAudio === message.id && (
                      <div className="h-1 w-16 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full animate-pulse" />
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
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-[8px] md:text-[10px] opacity-70 text-pink-400">
                  {message.timestamp?.toDate().toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
                {/* Message status indicators */}
                {message.senderId === user?.uid && (
                  <div className="flex items-center gap-1">
                    {message.status === 'sent' && (
                      <span className="text-[10px] text-gray-400">✓</span>
                    )}
                    {message.status === 'delivered' && (
                      <span className="text-[10px] text-gray-400">✓✓</span>
                    )}
                    {message.status === 'read' && (
                      <span className="text-[10px] text-blue-500">✓✓</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
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
      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Voice Recorder Modal */}
      {showVoiceRecorder && (
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
              Are you sure you want to delete this {messageToDelete?.type === 'audio' ? 'voice message' : 'message'}? This action cannot be undone.
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

      <form onSubmit={handleSendMessage} className="p-1 md:p-2 border-t bg-white/80 backdrop-blur-lg" style={{ borderColor: themeColors.brand.blue.deep }}>
        <div className="flex gap-1 md:gap-2 items-center">
          {/* Dropdown for Media & Emoji Buttons */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 md:h-8 md:w-8 text-blue-400">
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleImageClick} className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-blue-400" /> Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleVideoClick} className="flex items-center gap-2">
                <Video className="h-4 w-4 text-blue-400" /> Video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowEmojiPicker(true)} className="flex items-center gap-2">
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
            disabled={uploading}
          />
          {/* Message Input */}
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 text-[#1A1A1A] placeholder:text-blue-400 bg-white/90 border border-blue-200 focus:ring-2 focus:ring-[#6B3BFF] focus:border-[#2B55FF] rounded-xl text-xs md:text-sm"
            disabled={uploading || isRecording}
          />
          {newMessage.trim() ? (
            <Button type="submit" size="icon" className="bg-white text-[#2B55FF] h-7 w-7 md:h-8 md:w-8 shadow hover:bg-[#6B3BFF]/10 focus:ring-2 focus:ring-[#6B3BFF] border border-blue-200" disabled={uploading}>
              <Send className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          ) : (
            <div className="relative">
              {!isRecording ? (
                <Button
                  type="button"
                  size="icon"
                  className="bg-white text-[#2B55FF] h-7 w-7 md:h-8 md:w-8 shadow hover:bg-[#6B3BFF]/10 focus:ring-2 focus:ring-[#6B3BFF] border border-blue-200"
                  onClick={startRecording}
                  disabled={uploading}
                >
                  <Mic className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="icon"
                    className="bg-red-500 hover:bg-red-600 text-white h-7 w-7 md:h-8 md:w-8 shadow"
                    onClick={cancelRecording}
                  >
                    <X className="h-3 w-3 md:h-4 md:w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    className="bg-green-500 hover:bg-green-600 text-white h-7 w-7 md:h-8 md:w-8 shadow"
                    onClick={stopRecording}
                  >
                    <Send className="h-3 w-3 md:h-4 md:w-4" />
                  </Button>
                  <div className="flex items-center px-2 bg-white/90 rounded-lg border border-blue-200">
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