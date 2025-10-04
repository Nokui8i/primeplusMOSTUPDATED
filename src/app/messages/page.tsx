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

  return (
    <div className="flex h-full bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Chat List Sidebar */}
      <div className={`${isMobileView ? (!selectedChat ? 'flex' : 'hidden') : 'flex'} w-72 flex-col bg-white border-r border-gray-200`}>
        <ChatList onSelectChat={handleSelectChat} />
      </div>

      {/* Chat Area */}
      <div className={`${isMobileView && !selectedChat ? 'hidden' : 'flex'} flex-1 flex-col bg-gray-50`}>
        {selectedChat ? (
          <Chat recipientId={selectedChat.recipientId} recipientName={selectedChat.recipientName} hideHeader={true} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-200 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">Select a conversation</h3>
              <p className="text-sm text-gray-500">Choose a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
