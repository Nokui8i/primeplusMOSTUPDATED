"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatList } from '@/components/chat/ChatList';
import { Chat } from '@/components/chat/Chat';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { MessageCircle, ChevronDown } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useMessages } from '@/contexts/MessagesContext';
import { motion, AnimatePresence } from 'framer-motion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

function MessagesPage() {
  const searchParams = useSearchParams();
  const { markAsRead } = useChat();
  const [isMobileView, setIsMobileView] = useState(false);
  const { searchQuery, filterType, setFilterType, selectedChat, setSelectedChat } = useMessages();

  const [key, setKey] = useState(0);
  
  useEffect(() => {
    setKey(prev => prev + 1);
  }, [selectedChat]);

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
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setSelectedChat({
              recipientId: userId,
              recipientName: userData.displayName || userData.username || 'Unknown User',
              recipientProfile: userData
            });
          }
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      };
      fetchUser();
    }
  }, [searchParams, setSelectedChat]);

  const handleSelectChat = async (recipientId: string, recipientName: string, sharedChatId?: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', recipientId));
      const userData = userDoc.exists() ? userDoc.data() : null;
      
      setSelectedChat({
        recipientId,
        recipientName,
        recipientProfile: userData
      });
      
      markAsRead(recipientId);
    } catch (error) {
      console.error('Error selecting chat:', error);
    }
  };

  const handleChatDeleted = () => {
    setSelectedChat(null);
  };

  return (
    <div key={key} className="relative flex bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden" style={{ height: isMobileView && selectedChat ? '100dvh' : isMobileView ? 'calc(100dvh - 104px)' : 'calc(100vh - 80px)' }}>
      <div className={`${isMobileView ? (!selectedChat ? 'flex' : 'hidden') : 'flex'} ${isMobileView ? 'w-full' : 'w-[400px]'} flex-col bg-white ${!isMobileView ? 'border-r border-gray-200' : ''}`}>
        {!isMobileView && (
          <div className="px-4 py-3 border-b border-gray-200" style={{ minHeight: '56px', maxHeight: '56px' }}>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900">Messages</h1>
              </div>
              <div className="flex-1 max-w-md"></div>
              <div className="flex items-center gap-0 flex-shrink-0 ml-auto -mr-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                      <ChevronDown className={`w-5 h-5 text-gray-600 transition-transform ${filterType === 'all' ? '' : 'rotate-180'}`} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setFilterType('all')}>
                      All Messages
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterType('unread')}>
                      Unread Only
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}
        <ChatList
          onSelectChat={handleSelectChat}
          onChatDeleted={handleChatDeleted}
          searchQuery={searchQuery}
          filterType={filterType}
        />
      </div>

      {selectedChat && (
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedChat.recipientId}
            initial={{ opacity: 0, x: isMobileView ? '100%' : 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isMobileView ? '100%' : 0 }}
            transition={{ duration: 0.2 }}
            className={`${isMobileView ? 'absolute inset-0' : 'flex-1'} ${isMobileView ? 'z-50' : ''} flex flex-col bg-white`}
            style={{ height: '100%' }}
          >
            <Chat
              recipientId={selectedChat.recipientId}
              recipientName={selectedChat.recipientName}
              recipientProfile={selectedChat.recipientProfile}
              onClose={isMobileView ? () => setSelectedChat(null) : undefined}
              hideHeader={!isMobileView}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {!selectedChat && (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No conversation selected</h2>
            <p className="text-gray-500">Select a conversation from the list to start messaging</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessagesPage;
