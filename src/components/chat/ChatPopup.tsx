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
      setDoc(chatRef, { typing: null }, { merge: true }).catch(console.error);
    };
  }, [user, currentUser]);

  // Set typing status when user types
  const debouncedSetTypingStatus = debounce((isTyping: boolean) => {
    if (!user || !user.uid || !currentUser?.uid) return;
    const chatId = [user.uid, currentUser.uid].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    setDoc(chatRef, { typing: isTyping ? currentUser.uid : null }, { merge: true });
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
      minimizeChat(user.uid); // Only open (un-minimize) if minimized
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
        className="fixed z-50 w-80 h-12 bg-blue-600 rounded-lg shadow-lg overflow-hidden bottom-0 right-0 flex items-center"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Header */}
        <div 
          className="chat-header bg-gradient-to-r from-[#6B3BFF] to-[#2B55FF] text-white p-2 cursor-pointer flex items-center justify-between w-full"
          onClick={handleHeaderClick}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 cursor-pointer hover:underline"
              onClick={e => {
                e.stopPropagation();
                router.push(`/${user.username}`);
              }}
            >
              <UserAvatar
                userId={user.uid}
                photoURL={user.photoURL}
                displayName={user.displayName || user.username}
                size="sm"
              />
              <div className="flex flex-col">
                <div className="flex items-center">
                  <span className="font-medium">{user.displayName || user.username}</span>
                  {(() => { console.log('isRecipientTyping', isRecipientTyping); return null; })()}
                  {isRecipientTyping && (
                    <span
                      className="ml-2 text-xs font-medium text-black select-none"
                    >
                      typing…
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <span className="text-xs text-white/80">
                    {unreadCount} new message{unreadCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isMinimized) minimizeChat(user.uid); // Only minimize if not already minimized
              }}
              className="p-1 hover:bg-white/10 rounded"
            >
              <FiMinus className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('Close button clicked for user:', user.uid);
                closeChat(user.uid);
              }}
              className="p-1 hover:bg-white/10 rounded"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not minimized: always at bottom right
  return (
    <div
      className="fixed z-50 w-80 h-96 bg-white rounded-lg shadow-lg overflow-hidden bottom-0 right-0"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Header */}
      <div
        className="chat-header bg-gradient-to-r from-[#6B3BFF] to-[#2B55FF] text-white p-2 cursor-pointer flex items-center justify-between w-full"
        onClick={() => {}}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 cursor-pointer hover:underline"
            onClick={e => {
              e.stopPropagation();
              router.push(`/${user.username}`);
            }}
          >
            <UserAvatar
              userId={user.uid}
              photoURL={user.photoURL}
              displayName={user.displayName || user.username}
              size="sm"
            />
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className="font-medium">{user.displayName || user.username}</span>
                {(() => { console.log('isRecipientTyping', isRecipientTyping); return null; })()}
                {isRecipientTyping && (
                  <span
                    className="ml-2 text-xs font-medium text-black select-none"
                  >
                    typing…
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              minimizeChat(user.uid);
            }}
            className="p-1 hover:bg-white/10 rounded"
          >
            <FiMinus className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log('Close button clicked for user:', user.uid);
              closeChat(user.uid);
            }}
            className="p-1 hover:bg-white/10 rounded"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="h-[calc(100%-3rem)]">
        <Chat 
          recipientId={user.uid} 
          recipientName={user.displayName || user.username} 
          hideHeader={true}
        />
      </div>
    </div>
  );
} 