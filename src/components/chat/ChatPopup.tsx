'use client';

import { UserProfile } from '@/lib/types/user';
import { useChat } from '@/contexts/ChatContext';
import { UserAvatar } from '@/components/user/UserAvatar';
import { FiMinus, FiX } from 'react-icons/fi';
import Draggable from 'react-draggable';
import { Chat } from './Chat';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { debounce } from 'lodash';

const TYPING_TIMEOUT = 3000; // 3 seconds

interface ChatPopupProps {
  user: UserProfile;
  position: { x: number; y: number };
  isMinimized: boolean;
  unreadCount: number;
}

export function ChatPopup({ user, position, isMinimized, unreadCount }: ChatPopupProps) {
  const { closeChat, minimizeChat, updatePosition, markAsRead } = useChat();
  const router = useRouter();
  
  const [isDraggable, setIsDraggable] = useState(false);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (!user || !user.uid || !currentUser?.uid) return;
    const chatId = [user.uid, currentUser.uid].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      const data = docSnap.data();
      setIsRecipientTyping(!!data?.typing && data.typing !== currentUser.uid);
    });

    // Cleanup function
    return () => {
      unsubscribe();
      // Clear typing status when component unmounts
      setDoc(chatRef, { typing: false }, { merge: true }).catch(console.error);
    };
  }, [user, currentUser]);

  // Set typing status when user types
  const debouncedSetTypingStatus = debounce((isTyping: boolean) => {
    if (!user || !user.uid || !currentUser?.uid) return;
    const chatId = [user.uid, currentUser.uid].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    setDoc(chatRef, { typing: isTyping ? currentUser.uid : false }, { merge: true });
  }, 300);

  useEffect(() => {
    if (newMessage) {
      debouncedSetTypingStatus(true);
    } else {
      debouncedSetTypingStatus(false);
    }
  }, [newMessage, user, currentUser]);

  // Cleanup when chat is closed
  useEffect(() => {
    return () => {
      if (newMessage) {
        debouncedSetTypingStatus(false);
      }
    };
  }, [newMessage, debouncedSetTypingStatus]);

  // When un-minimizing, keep at bottom right, then allow dragging after first move
  const handleHeaderClick = () => {
    if (isMinimized) {
      minimizeChat(user.uid); // Toggle to un-minimize
      markAsRead(user.uid);
      setIsDraggable(false);
    }
  };

  // Mark messages as read when chat is opened
  useEffect(() => {
    if (!isMinimized) {
      markAsRead(user.uid);
    }
  }, [isMinimized, user.uid]);

  if (isMinimized) {
    return (
      <div
        className="fixed z-50 w-64 rounded-t-lg bg-white shadow-2xl"
        style={{ 
          position: 'fixed',
          right: `${position.x}px`,
          bottom: `${position.y}px`,
          pointerEvents: 'auto',
          zIndex: 50
        }}
      >
        <div 
          className="relative flex w-full items-center justify-between px-3 py-2 cursor-pointer"
          onClick={handleHeaderClick}
        >
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
              />
            </svg>
            <div 
              className="font-semibold text-gray-800 cursor-pointer hover:text-blue-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/${user.username || user.uid}`);
              }}
            >
              {user.displayName || user.username}
            </div>
          </div>
          <button
            className="group peer cursor-pointer rounded-full p-2 hover:bg-gray-100 focus:bg-gray-200"
            onClick={(e) => {
              e.stopPropagation();
              minimizeChat(user.uid);
            }}
          >
            <FiMinus className="size-5" />
          </button>
          <div className="invisible absolute right-3 bottom-2 translate-y-full rounded-lg bg-gray-800 p-2 text-white opacity-0 transition-all peer-focus:visible peer-focus:opacity-100">
            <div className="text-xs">Version 1.0.0</div>
          </div>
        </div>
        {unreadCount > 0 && (
          <div className="px-3 pb-2">
            <div className="text-xs text-gray-500">
              {unreadCount} new message{unreadCount !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not minimized: always at bottom right
  return (
    <div
      className="fixed z-50 w-80 h-96 bg-white rounded-t-lg shadow-2xl overflow-hidden"
      style={{
        position: 'fixed',
        right: `${position.x}px`,
        bottom: `${position.y}px`,
        pointerEvents: 'auto',
        zIndex: 50,
      }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="relative flex w-full items-center justify-between px-3 py-2 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
              />
            </svg>
            <div 
              className="font-semibold text-gray-800 cursor-pointer hover:text-blue-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/${user.username || user.uid}`);
              }}
            >
              {user.displayName || user.username}
            </div>
            {isRecipientTyping && (
              <div className="flex items-center gap-1">
                <div className="size-2 rounded-full bg-gray-300 animate-pulse"></div>
                <div className="size-2 rounded-full bg-gray-400 animate-pulse"></div>
                <div className="size-2 rounded-full bg-gray-300 animate-pulse"></div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="group peer cursor-pointer rounded-full p-2 hover:bg-gray-100 focus:bg-gray-200"
              onClick={(e) => {
                e.stopPropagation();
                minimizeChat(user.uid);
              }}
            >
              <FiMinus className="size-5" />
            </button>
            <button
              className="cursor-pointer rounded-full p-2 hover:bg-gray-100 focus:bg-gray-200"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                closeChat(user.uid);
              }}
            >
              <FiX className="h-4 w-4" />
            </button>
            <div className="invisible absolute right-3 bottom-2 translate-y-full rounded-lg bg-gray-800 p-2 text-white opacity-0 transition-all peer-focus:visible peer-focus:opacity-100">
              <div className="text-xs">Version 1.0.0</div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <Chat 
            recipientId={user.uid} 
            recipientName={user.displayName || user.username} 
            hideHeader={true}
            customWidth={100}
            recipientProfile={user}
          />
        </div>
      </div>
    </div>
  );
} 