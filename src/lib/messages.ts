'use client';

import {
  collection,
  query,
  where,
  orderBy,
  addDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  getDoc,
  doc,
  updateDoc,
  arrayUnion,
  Timestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';

export interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date;
  read: boolean;
  attachments?: {
    type: 'image' | 'video' | 'file';
    url: string;
    name: string;
    size: number;
  }[];
  reactions?: {
    [userId: string]: string; // emoji
  };
  replyTo?: {
    messageId: string;
    text: string;
  };
  recipientId: string;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Create a new chat between users
export async function createChat(participants: string[]) {
  try {
    // Only allow real UIDs (no underscores, length 28 for Firebase UIDs)
    const realUIDs = participants.filter(id => typeof id === 'string' && id.length >= 20 && id.length <= 40 && !id.includes('_'));
    const chatRef = await addDoc(collection(db, 'chats'), {
      participants: realUIDs,
      createdAt: serverTimestamp(),
      typing: false,
      unreadCounts: realUIDs.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}),
    });
    return chatRef.id;
  } catch (error) {
    console.error('Error creating chat:', error);
    throw error;
  }
}

// Get all chats for a user
export function getUserChats(userId: string, callback: (chats: Chat[]) => void) {
  const chatsRef = collection(db, 'chats');
  const q = query(
    chatsRef,
    where('participants', 'array-contains', userId),
    orderBy('lastMessageTime', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      lastMessageTime: doc.data().lastMessageTime?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Chat[];
    callback(chats);
  });
}

// Send a message in a chat
export async function sendMessage(recipientUsername: string, text: string) {
  const auth = useAuth();
  if (!auth.user) throw new Error('You must be logged in to send messages');

  // First, find the recipient user by username
  const usersRef = collection(db, 'users');
  const recipientQuery = query(usersRef, where('username', '==', recipientUsername));
  const recipientSnapshot = await getDocs(recipientQuery);

  if (recipientSnapshot.empty) {
    throw new Error('Recipient not found');
  }

  const recipientDoc = recipientSnapshot.docs[0];
  const recipientId = recipientDoc.id;

  // Create the message
  const messagesRef = collection(db, 'messages');
  const messageData = {
    senderId: auth.user.uid,
    recipientId,
    text,
    timestamp: serverTimestamp(),
    read: false,
  };

  await addDoc(messagesRef, messageData);
}

// Update typing status
export async function updateTypingStatus(chatId: string, userId: string, isTyping: boolean) {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      typing: isTyping ? userId : false,
    });
  } catch (error) {
    console.error('Error updating typing status:', error);
    throw error;
  }
}

// Add reaction to message
export async function addReaction(chatId: string, messageId: string, userId: string, emoji: string) {
  try {
    const messageRef = doc(db, `chats/${chatId}/messages`, messageId);
    await updateDoc(messageRef, {
      [`reactions.${userId}`]: emoji,
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    throw error;
  }
}

// Remove reaction from message
export async function removeReaction(chatId: string, messageId: string, userId: string) {
  try {
    const messageRef = doc(db, `chats/${chatId}/messages`, messageId);
    await updateDoc(messageRef, {
      [`reactions.${userId}`]: null,
    });
  } catch (error) {
    console.error('Error removing reaction:', error);
    throw error;
  }
}

// Get messages for a chat
export function getChatMessages(chatId: string, callback: (messages: Message[]) => void) {
  const messagesRef = collection(db, `chats/${chatId}/messages`);
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    })) as Message[];
    callback(messages);
  });
}

// Mark messages as read
export async function markMessagesAsRead(chatId: string, userId: string) {
  try {
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(
      messagesRef,
      where('read', '==', false),
      where('senderId', '!=', userId)
    );
    
    const snapshot = await getDocs(q);
    const batch = snapshot.docs.map((doc) =>
      updateDoc(doc.ref, { read: true })
    );
    
    await Promise.all(batch);
    
    // Reset unread count for the user
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`unreadCounts.${userId}`]: 0,
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
}

// Update user's online status
export async function updateOnlineStatus(userId: string, isOnline: boolean) {
  try {
    const userStatusRef = doc(db, 'userStatus', userId);
    await setDoc(userStatusRef, {
      online: isOnline,
      lastSeen: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating online status:', error);
    throw error;
  }
}

// Get user's online status
export function getUserOnlineStatus(userId: string, callback: (status: { online: boolean; lastSeen: Date }) => void) {
  const userStatusRef = doc(db, 'userStatus', userId);
  
  return onSnapshot(userStatusRef, (doc) => {
    const data = doc.data();
    callback({
      online: data?.online || false,
      lastSeen: data?.lastSeen?.toDate() || new Date(),
    });
  });
}

export function useMessages(otherUserId?: string) {
  const auth = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!auth.user) return;

    const messagesRef = collection(db, 'messages');
    let q = query(
      messagesRef,
      where('senderId', 'in', [auth.user.uid, otherUserId]),
      where('recipientId', 'in', [auth.user.uid, otherUserId]),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Message[];
        setMessages(newMessages);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching messages:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth.user, otherUserId]);

  return { messages, loading, error };
}

export function useUnreadCount() {
  const auth = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!auth.user) return;

    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('recipientId', '==', auth.user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    });

    return () => unsubscribe();
  }, [auth.user]);

  return unreadCount;
}

export async function markMessageAsRead(messageId: string) {
  const messageRef = doc(db, 'messages', messageId);
  await updateDoc(messageRef, { read: true });
}

export function useTotalUnreadMessagesCount() {
  const auth = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!auth.user || !auth.user.uid) {
      setUnreadCount(0);
      return;
    }

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', auth.user.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let totalUnread = 0;
      const chatDocs = snapshot.docs;
      await Promise.all(chatDocs.map(async (chatDoc) => {
        const chatId = chatDoc.id;
        const messagesRef = collection(db, `chats/${chatId}/messages`);
        // Only count messages not sent by the current user and not read
        const unreadQuery = query(
          messagesRef,
          where('read', '==', false),
          where('senderId', '!=', auth.user!.uid)
        );
        const unreadSnapshot = await getDocs(unreadQuery);
        totalUnread += unreadSnapshot.size;
      }));
      setUnreadCount(totalUnread);
    });

    return () => unsubscribe();
  }, [auth.user]);

  return unreadCount;
} 