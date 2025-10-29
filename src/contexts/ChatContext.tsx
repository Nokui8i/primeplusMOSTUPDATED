'use client';

import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { UserProfile } from '@/lib/types/user';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDoc, getDocs, writeBatch, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { auth } from '@/lib/firebase/config';

interface ChatWindow {
  id: string;
  user: UserProfile;
  isMinimized: boolean;
  position: { x: number; y: number };
  unreadCount: number;
}

interface ChatContextType {
  chatWindows: ChatWindow[];
  openChat: (user: UserProfile) => void;
  closeChat: (userId: string) => void;
  minimizeChat: (userId: string) => void;
  updatePosition: (userId: string, position: { x: number; y: number }) => void;
  markAsRead: (userId: string) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chatWindows, setChatWindows] = useState<ChatWindow[]>([]);
  const [closedChats, setClosedChats] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('closedChats');
      if (stored) return new Set(JSON.parse(stored));
    }
    return new Set();
  });
  const { user } = useAuth();
  const [lastSeenMessageIds, setLastSeenMessageIds] = useState<Record<string, string>>({});
  const chatWindowsRef = useRef<ChatWindow[]>([]);
  
  // Update ref whenever chatWindows changes
  useEffect(() => {
    chatWindowsRef.current = chatWindows;
  }, [chatWindows]);

  // Persist closedChats to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('closedChats', JSON.stringify(Array.from(closedChats)));
    }
  }, [closedChats]);

  // Listen for new messages in all user chats
  useEffect(() => {
    if (!user) return;

    // Listen to all chats where the user is a participant
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const chatUnsubscribes: (() => void)[] = [];

    const unsubscribeChats = onSnapshot(chatsQuery, (chatsSnapshot) => {
      chatsSnapshot.forEach((chatDoc) => {
        const chatId = chatDoc.id;
        const chatData = chatDoc.data();
        const otherParticipantId = (chatData.participants as string[]).find((id) => id !== user.uid);
        if (!otherParticipantId) return;

        // Skip if this chat is in closedChats
        if (closedChats.has(otherParticipantId)) {
          return;
        }

        // Listen to new messages in this chat
        const messagesQuery = query(
          collection(db, 'chats', chatId, 'messages'),
          orderBy('timestamp', 'desc'),
        );
        const unsubscribeMessages = onSnapshot(messagesQuery, async (messagesSnapshot) => {
          // Only consider the latest message
          const latestDoc = messagesSnapshot.docs[0];
          if (!latestDoc) return;
          const messageData = latestDoc.data();
          const senderId = messageData.senderId;
          if (senderId === user.uid) return; // Ignore own messages

          // Only process if this message is new
          if (lastSeenMessageIds[chatId] === latestDoc.id) return;
          setLastSeenMessageIds(prev => ({ ...prev, [chatId]: latestDoc.id }));

          // Check if chat window already exists (using ref to avoid re-subscription)
          const existingWindow = chatWindowsRef.current.find(window => window.user.uid === senderId);
          if (existingWindow) {
            // Update existing window with unread count
            setChatWindows(prev => prev.map(window => 
              window.user.uid === senderId
                ? { ...window, unreadCount: (window.unreadCount || 0) + 1 }
                : window
            ));
          }
          // Don't automatically create new chat windows for new messages
          // Chat windows should only be created when user explicitly opens them
        });
        chatUnsubscribes.push(unsubscribeMessages);
      });
    });
    chatUnsubscribes.push(unsubscribeChats);

    return () => {
      chatUnsubscribes.forEach(unsub => unsub());
    };
  }, [user, closedChats]);

  const openChat = async (user: UserProfile) => {
    console.log('openChat called for', user.uid);
    
    // Validate user profile
    if (!user || !user.uid) {
      console.error('Invalid user profile:', user);
      return;
    }

    // Ensure current user exists
    if (!auth.currentUser) {
      console.error('No authenticated user');
      return;
    }

    // Create Firestore chat document immediately
    try {
      const chatId = [auth.currentUser.uid, user.uid].sort().join('_');
      const chatRef = doc(db, 'chats', chatId);
      
      // Create or update chat document with all required fields
      await setDoc(chatRef, {
        participants: [auth.currentUser.uid, user.uid],
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        unreadCounts: {
          [auth.currentUser.uid]: 0,
          [user.uid]: 0
        },
        typing: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log('Chat document created/updated:', chatId);
    } catch (error) {
      console.error('Error creating chat document:', error);
      return;
    }

    setChatWindows(prev => {
      // If chat already exists, just un-minimize it and clear unread count
      if (prev.some(window => window.user.uid === user.uid)) {
        return prev.map(window => 
          window.user.uid === user.uid 
            ? { ...window, isMinimized: false, unreadCount: 0 }
            : window
        );
      }

      // Calculate position for new chat window (attached to taskbar)
      const newPosition = {
        x: 20 + (prev.length * 20), // 20px from right edge + offset for multiple chats
        y: 0  // Attached to bottom edge (taskbar level)
      };
      

      // Ensure the window is not minimized when first opened
      const newWindows = [...prev, {
        id: user.uid,
        user,
        isMinimized: false,
        position: newPosition,
        unreadCount: 0
      }];
      console.log('chatWindows after openChat:', newWindows);
      return newWindows;
    });
  };

  const closeChat = (userId: string) => {
    console.log('Closing chat for user:', userId);
    // First remove from chatWindows
    setChatWindows(prev => {
      const newWindows = prev.filter(window => window.user.uid !== userId);
      console.log('Updated chat windows:', newWindows);
      return newWindows;
    });
    
    // Then add to closedChats
    setClosedChats(prev => {
      const newClosedChats = new Set([...Array.from(prev), userId]);
      console.log('Updated closed chats:', Array.from(newClosedChats));
      return newClosedChats;
    });

    // Clean up any existing listeners for this chat
    if (user) {
      const chatId = [user.uid, userId].sort().join('_');
      const chatRef = doc(db, 'chats', chatId);
      // Remove typing status
      setDoc(chatRef, { typing: false }, { merge: true }).catch(console.error);
    }
  };

  const minimizeChat = (userId: string) => {
    setChatWindows(prev => 
      prev.map(window => 
        window.user.uid === userId 
          ? { ...window, isMinimized: !window.isMinimized }
          : window
      )
    );
  };

  const updatePosition = (userId: string, position: { x: number; y: number }) => {
    setChatWindows(prev => 
      prev.map(window => 
        window.user.uid === userId 
          ? { ...window, position }
          : window
      )
    );
  };

  const markAsRead = async (userId: string) => {
    console.log('🔍 markAsRead called with userId:', userId);
    if (!userId) {
      console.error('markAsRead called with undefined userId');
      return;
    }

    // Update local state
    console.log('🔍 Updating local state for userId:', userId);
    setChatWindows(prev => 
      prev.map(window => 
        window.user.uid === userId 
          ? { ...window, unreadCount: 0 }
          : window
      )
    );

    // Update Firestore
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const chatId = [currentUser.uid, userId].sort().join('_');
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const unreadQuery = query(
        messagesRef,
        where('senderId', '==', userId),
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
        console.log('🔍 Found', snapshot.size, 'unread messages, committing batch');
        await batch.commit();
      }
      
      // Update chat metadata unread count in shared chat
      const chatRef = doc(db, 'chats', chatId);
      console.log('🔍 Updating chat metadata unread count for chatId:', chatId);
      await updateDoc(chatRef, {
        [`unreadCounts.${currentUser.uid}`]: 0
      });
      
      // Update user's personal chat unreadCount
      const userChatId = `${currentUser.uid}_${userId}`;
      const userChatRef = doc(db, 'users', currentUser.uid, 'chats', userChatId);
      const userChatDoc = await getDoc(userChatRef);
      
      if (userChatDoc.exists()) {
        await updateDoc(userChatRef, {
          unreadCount: 0,
          updatedAt: serverTimestamp()
        });
        console.log('🔍 Successfully updated personal chat unreadCount');
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  return (
    <ChatContext.Provider value={{
      chatWindows,
      openChat,
      closeChat,
      minimizeChat,
      updatePosition,
      markAsRead
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
} 