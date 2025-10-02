"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatList } from '@/components/chat/ChatList';
import { Chat } from '@/components/chat/Chat';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const [selectedChat, setSelectedChat] = useState<{
    recipientId: string;
    recipientName: string;
  } | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!searchParams) return;
    
    const userId = searchParams.get('user');
    if (userId) {
      // Fetch user details
      const fetchUser = async () => {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setSelectedChat({
            recipientId: userId,
            recipientName: userData.displayName || userData.username || 'Unknown User'
          });
        }
      };
      fetchUser();
    }
  }, [searchParams]);

  const handleSelectChat = (recipientId: string, recipientName: string) => {
    setSelectedChat({ recipientId, recipientName });
  };

  const handleBack = () => {
    setSelectedChat(null);
  };

  return (
    <div className="relative">
      <div className="relative flex flex-col bg-white/80 backdrop-blur-sm z-20 max-w-4xl w-full mx-auto my-4 rounded-2xl shadow-xl border border-gray-200 h-[90vh]">
        <div className="border-b p-2 md:p-4">
          <div className="flex items-center gap-2">
            {selectedChat && (
              <button
                onClick={handleBack}
                className="md:hidden p-2 hover:bg-gray-100 rounded-full"
              >
                ←
              </button>
            )}
            <h1 className="text-xl md:text-2xl font-bold text-black">Messages</h1>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden h-full">
          {/* Always show ChatList as a sidebar on desktop, and as main view on mobile when no chat is selected */}
          <div className={`h-full ${isMobileView ? (!selectedChat ? 'flex-1' : 'hidden') : 'w-80 flex-shrink-0 border-r border-gray-100 bg-white'}`}>
            <ChatList onSelectChat={handleSelectChat} />
          </div>
          {/* Always show Chat on desktop, and on mobile only when a chat is selected */}
          <div className={`${isMobileView && !selectedChat ? 'hidden' : 'flex-1'} h-full`}>
            {selectedChat ? (
              <Chat recipientId={selectedChat.recipientId} recipientName={selectedChat.recipientName} />
            ) : (
              <div className="flex items-center justify-center h-full text-black">
                Select a chat to start messaging
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 