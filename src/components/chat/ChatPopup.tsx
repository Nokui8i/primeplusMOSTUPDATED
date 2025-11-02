'use client';

import { UserProfile } from '@/lib/types/user';
import { useChat } from '@/contexts/ChatContext';
import { UserAvatar } from '@/components/user/UserAvatar';
import { FiMinus, FiX } from 'react-icons/fi';
import Draggable from 'react-draggable';
import { Chat } from './Chat';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { debounce } from 'lodash';
import { Search, Pin, Grid3x3 } from 'lucide-react';

const TYPING_TIMEOUT = 3000; // 3 seconds

interface ChatPopupProps {
  user: UserProfile;
  position: { x: number; y: number };
  isMinimized: boolean;
  unreadCount: number;
  isMobile?: boolean;
}

export function ChatPopup({ user, position, isMinimized, unreadCount, isMobile = false }: ChatPopupProps) {
  const { closeChat, minimizeChat, updatePosition, markAsRead } = useChat();
  const router = useRouter();
  
  const [isDraggable, setIsDraggable] = useState(false);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const { user: currentUser } = useAuth();
  
  // Chat features state (Gallery, Search, Pin)
  const [showGallery, setShowGallery] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  
  // Track keyboard state for mobile
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  
  // Load pinned status when chat opens
  useEffect(() => {
    if (!currentUser?.uid || !user?.uid || isMinimized) return;
    
    const loadPinnedStatus = async () => {
      try {
        const chatId = [currentUser.uid, user.uid].sort().join('_');
        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);
        
        if (chatDoc.exists()) {
          const pinnedBy = chatDoc.data().pinnedBy || {};
          setIsPinned(!!pinnedBy[currentUser.uid]);
        }
      } catch (error) {
        console.error('Error loading pinned status:', error);
      }
    };
    
    loadPinnedStatus();
  }, [currentUser?.uid, user?.uid, isMinimized]);
  
  // Detect keyboard state on mobile
  useEffect(() => {
    if (!isMobile || isMinimized || typeof window === 'undefined' || !window.visualViewport) return;
    
    const vv = window.visualViewport;
    const initialHeight = window.innerHeight;
    
    const checkKeyboard = () => {
      const currentHeight = vv.height;
      const heightDiff = initialHeight - currentHeight;
      // Keyboard is open if height decreased significantly (more than 150px)
      setIsKeyboardOpen(heightDiff > 150);
    };
    
    // Initial check
    checkKeyboard();
    
    // Listen to viewport changes
    vv.addEventListener('resize', checkKeyboard);
    
    return () => {
      vv.removeEventListener('resize', checkKeyboard);
    };
  }, [isMobile, isMinimized]);

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

  // CRITICAL: Lock body scroll when mini chat popup is open on mobile
  // This prevents page content from jumping up when keyboard opens
  useEffect(() => {
    if (!isMobile || isMinimized || typeof window === 'undefined') return;

    // Save scroll position BEFORE locking (prevents content jump)
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    const originalBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      width: document.body.style.width,
      height: document.body.style.height,
      top: document.body.style.top,
      left: document.body.style.left,
    };
    
    // Lock body scroll while preserving scroll position
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.top = `-${scrollY}px`; // Prevent jump
    document.body.style.left = `-${scrollX}px`;
    document.documentElement.style.overflow = 'hidden';

    return () => {
      // Restore original styles
      document.body.style.overflow = originalBodyStyle.overflow;
      document.body.style.position = originalBodyStyle.position;
      document.body.style.width = originalBodyStyle.width;
      document.body.style.height = originalBodyStyle.height;
      document.body.style.top = originalBodyStyle.top;
      document.body.style.left = originalBodyStyle.left;
      document.documentElement.style.overflow = '';
      
      // Restore scroll position
      window.scrollTo(scrollX, scrollY);
    };
  }, [isMobile, isMinimized]);

  // Calculate bottom offset for mobile (above NAV BAR)
  // BottomNavigation is: h-14 (56px) + safe-area-bottom
  // For minimized: add 10px spacing
  // For expanded: starts right above NAV BAR
  const mobileMinimizedBottom = isMobile 
    ? 'calc(56px + env(safe-area-inset-bottom, 0px) + 10px)'
    : `${position.y}px`;
  const mobileExpandedBottom = isMobile
    ? 'calc(56px + env(safe-area-inset-bottom, 0px))'
    : `${position.y}px`;

  if (isMinimized) {
    return (
      <div
        className={`fixed z-[60] rounded-t-lg bg-white shadow-2xl ${isMobile ? 'w-full' : 'w-64'}`}
        style={{
          position: 'fixed',
          right: isMobile ? '0' : `${position.x}px`,
          left: isMobile ? '0' : undefined,
          bottom: isMobile ? mobileMinimizedBottom : `${position.y}px`,
          pointerEvents: 'auto',
          zIndex: 60, // Above NAV BAR (z-50)
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
          {/* Hide minimize button on mobile - only show on desktop */}
          {!isMobile && (
            <button
              className="group peer cursor-pointer rounded-full p-2 hover:bg-gray-100 focus:bg-gray-200"
              onClick={(e) => {
                e.stopPropagation();
                minimizeChat(user.uid);
              }}
            >
              <FiMinus className="size-5" />
            </button>
          )}
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

  // Not minimized: windowed popup (same style on mobile and desktop - exactly like PC)
  // On mobile: when expanded, position at bottom (no NAV BAR above)
  // When keyboard is closed, make it full screen
  const mobileBottomWhenExpanded = isMobile && !isMinimized
    ? '0'
    : isMobile
    ? mobileExpandedBottom
    : `${position.y}px`;

  return (
    <>
      {/* Overlay to block clicks on content behind */}
      {isMobile && (
        <div
          className="fixed inset-0 bg-black/0 z-[59]"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'auto',
            zIndex: 59, // Just below chat popup
          }}
          onClick={(e) => {
            // Close chat when clicking on overlay
            e.stopPropagation();
            closeChat(user.uid);
          }}
        />
      )}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`fixed bg-white shadow-2xl overflow-hidden ${
          isMobile && !isMinimized && !isKeyboardOpen
            ? 'w-full h-[85vh] rounded-t-lg' // Mobile: 85% of viewport height when keyboard closed
            : isMobile && !isMinimized
            ? 'w-full h-96 rounded-t-lg' // Mobile: full width, fixed height when keyboard open
            : isMobile
            ? 'w-full rounded-t-lg' // Mobile minimized
            : 'w-80 h-96 rounded-t-lg' // Desktop: exactly 320px x 384px like PC
        }`}
        style={{
          position: 'fixed',
          right: isMobile ? '0' : `${position.x}px`,
          left: isMobile ? '0' : undefined,
          top: isMobile && !isMinimized && !isKeyboardOpen ? 'auto' : undefined,
          bottom: isMobile ? mobileBottomWhenExpanded : `${position.y}px`,
          pointerEvents: 'auto',
          zIndex: 60, // Above NAV BAR (z-50) and overlay (z-59)
          // Same shadow as PC
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => {
          // Prevent clicks from propagating to overlay
          e.stopPropagation();
        }}
      >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="relative flex w-full items-center justify-between px-3 py-2 border border-gray-200 rounded-t-lg">
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
          
          {/* Action Buttons Group - Gallery, Search, Pin */}
          <div className="ml-auto flex items-center gap-1">
            {/* Gallery Button */}
            <button
              className={`p-1.5 rounded-full hover:bg-gray-100 transition-all duration-200 focus:outline-none ${showGallery ? 'bg-blue-50' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowGallery(!showGallery);
                setShowSearch(false);
              }}
              title="View gallery"
            >
              <svg className={`w-4 h-4 ${showGallery ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                setShowGallery(false);
              }}
              title="Search in conversation"
            >
              <Search className={`w-4 h-4 ${showSearch ? 'text-blue-600' : 'text-gray-600'}`} />
            </button>
            
            {/* Pin Conversation Button */}
            <button
              className={`p-1.5 rounded-full hover:bg-gray-100 transition-all duration-200 focus:outline-none ${isPinned ? 'bg-blue-50' : ''}`}
              onClick={async (e) => {
                e.stopPropagation();
                if (!currentUser?.uid) return;
                try {
                  const chatId = [currentUser.uid, user.uid].sort().join('_');
                  const chatRef = doc(db, 'chats', chatId);
                  const chatDoc = await getDoc(chatRef);
                  
                  if (chatDoc.exists()) {
                    const newPinned = !isPinned;
                    
                    // Update pinnedBy in chat document
                    await updateDoc(chatRef, {
                      [`pinnedBy.${currentUser.uid}`]: newPinned
                    });
                    
                    // Also update user's personal chat document for consistency (for ChatList)
                    const userChatId = `${currentUser.uid}_${user.uid}`;
                    const userChatRef = doc(db, 'users', currentUser.uid, 'chats', userChatId);
                    await updateDoc(userChatRef, {
                      pinned: newPinned,
                      updatedAt: serverTimestamp()
                    }).catch(() => {
                      // User chat might not exist yet, that's ok
                    });
                    
                    setIsPinned(newPinned);
                  }
                } catch (error) {
                  console.error('Error pinning conversation:', error);
                }
              }}
              title={isPinned ? "Unpin conversation" : "Pin conversation"}
            >
              <Pin className={`w-4 h-4 ${isPinned ? 'text-blue-600 fill-blue-600' : 'text-gray-600'}`} />
            </button>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Hide minimize button on mobile - only show close button */}
            {!isMobile && (
              <button
                className="group peer cursor-pointer rounded-full p-2 hover:bg-gray-100 focus:bg-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  minimizeChat(user.uid);
                }}
              >
                <FiMinus className="size-5" />
              </button>
            )}
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
            externalShowGallery={showGallery}
            externalSetShowGallery={setShowGallery}
            externalShowSearch={showSearch}
            externalSetShowSearch={setShowSearch}
          />
        </div>
      </div>
    </motion.div>
    </>
  );
} 