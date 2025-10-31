﻿"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChatList } from '@/components/chat/ChatList';
import { Chat } from '@/components/chat/Chat';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { MessageCircle, Search as SearchIcon, ChevronDown } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useMessages } from '@/contexts/MessagesContext';
import { motion, AnimatePresence } from 'framer-motion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { markAsRead } = useChat();
  const [isMobileView, setIsMobileView] = useState(false);
  const { searchQuery, filterType, setSearchQuery, setFilterType, selectedChat, setSelectedChat } = useMessages();

  // Force re-render when selectedChat changes to fix layout
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
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setSelectedChat({
              recipientId: userId,
              recipientName: userData.displayName || userData.username || 'Unknown User',
              recipientProfile: userData
            });
        }
      };
      fetchUser();
    }
  }, [searchParams]);

  const handleSelectChat = async (recipientId: string, recipientName: string, sharedChatId?: string) => {
    console.log('🔍 Selecting chat:', recipientId, recipientName, sharedChatId);
    
    try {
      const userDoc = await getDoc(doc(db, 'users', recipientId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
      setSelectedChat({
        recipientId,
        recipientName,
          recipientProfile: userData,
          sharedChatId: sharedChatId
      });
      } else {
        setSelectedChat({ recipientId, recipientName, sharedChatId: sharedChatId });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setSelectedChat({ recipientId, recipientName, sharedChatId: sharedChatId });
    }

    console.log('🔍 Calling markAsRead for:', recipientId);
    markAsRead(recipientId);

    // On mobile, navigate to dedicated thread route like OnlyFans
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      router.push(`/messages/${recipientId}`);
      return;
    }
  };

  return (
      <div key={key} className="relative flex bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden" style={{ height: isMobileView && selectedChat ? 'calc(100vh)' : isMobileView ? 'calc(100vh - 104px)' : 'calc(100vh - 80px)' }}>
      {/* Left Column - Chat List */}
      <div className={`${isMobileView ? (!selectedChat ? 'flex' : 'hidden') : 'flex'} ${isMobileView ? 'w-full' : 'w-[400px]'} flex-col bg-white ${!isMobileView ? 'border-r border-gray-200' : ''}`}>
        {/* Only desktop shows internal header, mobile uses MainLayout header */}
        {!isMobileView && (
        <div className="px-4 py-3 border-b border-gray-200" style={{ minHeight: '56px', maxHeight: '56px' }}>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900">Messages</h1>
              </div>
              <div className="flex-1 max-w-md"></div>
              <div className="flex items-center gap-0 flex-shrink-0 ml-auto -mr-2">
                {/* Messages Search */}
                <div className="relative mr-2">
                  <style jsx>{`
                    .search-container-messages-page {
                      position: relative !important;
                      --size-button: 32px;
                      width: 32px !important;
                      transition: width ease 0.3s !important;
                    }
                    
                    .search-container-messages-page:has(input:focus) {
                      width: 150px !important;
                    }
                    
                    .search-input-messages-page {
                      padding-right: var(--size-button) !important;
                      padding-left: 8px !important;
                      height: var(--size-button) !important;
                      font-size: 14px !important;
                      border: 2px solid transparent !important;
                      color: #000 !important;
                      outline: none !important;
                      width: 100% !important;
                      transition: border ease 0.3s !important;
                      background-color: transparent !important;
                      border-radius: 10px !important;
                      cursor: pointer !important;
                    }
                    
                    .search-input-messages-page:focus {
                      cursor: text !important;
                      border: 1px solid #d1d5db !important;
                      background-color: white !important;
                    }
                    
                    .search-icon-messages-page {
                      position: absolute !important;
                      width: var(--size-button) !important;
                      height: var(--size-button) !important;
                      top: 0 !important;
                      right: 0 !important;
                      padding: 6px !important;
                      pointer-events: none !important;
                    }
                  `}</style>
                  <div className="search-container-messages-page">
                    <input
                      type="text"
                      name="search"
                      className="search-input-messages-page"
                      required
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoComplete="off"
                    />
                    <div className="search-icon-messages-page">
                      <SearchIcon className="w-full h-full text-gray-500" />
                    </div>
                  </div>
                </div>
                
                {/* Messages Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="px-2 py-1 rounded-full flex items-center gap-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition-all duration-200 focus:outline-none focus:ring-0">
                      <span className="text-xs font-medium">
                        {filterType === 'all' ? 'All' : filterType === 'unread' ? 'Unread' : 'Pinned'}
                      </span>
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-24 bg-white border-0 overflow-hidden p-0"
                    style={{
                      borderRadius: '12px',
                      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                    }}
                  >
                    <DropdownMenuItem 
                      onClick={() => setFilterType('all')}
                      className={`cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 ${
                        filterType === 'all' ? 'text-blue-600' : 'text-gray-700'
                      }`}
                      style={{ fontWeight: '500', fontSize: '12px' }}
                    >
                      All
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setFilterType('unread')}
                      className={`cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 ${
                        filterType === 'unread' ? 'text-blue-600' : 'text-gray-700'
                      }`}
                      style={{ fontWeight: '500', fontSize: '12px' }}
                    >
                      Unread
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setFilterType('pinned')}
                      className={`cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 ${
                        filterType === 'pinned' ? 'text-blue-600' : 'text-gray-700'
                      }`}
                      style={{ fontWeight: '500', fontSize: '12px' }}
                    >
                      Pinned
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}
        
        {/* Filter Header */}
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold uppercase text-gray-600">
            {filterType === 'all' ? 'All Messages' : filterType === 'unread' ? 'Unread Messages' : 'Pinned Messages'}
          </h2>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-hidden" style={{ minHeight: 0, paddingBottom: isMobileView ? '56px' : '0' }}>
          <ChatList
            onSelectChat={handleSelectChat}
            onChatDeleted={(recipientId) => {
              // Close the chat if it's the one that was deleted
              if (selectedChat && selectedChat.recipientId === recipientId) {
                setSelectedChat(null);
              }
            }}
            searchQuery={searchQuery}
            filterType={filterType}
          />
        </div>
      </div>

      {/* Right Column - Chat Area */}
      {isMobileView ? (
        <AnimatePresence>
      {selectedChat && (
          <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-0 z-50 bg-white"
              style={{ pointerEvents: 'auto', overflow: 'hidden' }}
          >
            <Chat
                key={`${selectedChat.recipientId}-${selectedChat.recipientName}`}
                recipientId={selectedChat.recipientId} 
                recipientName={selectedChat.recipientName} 
                hideHeader={false}
                onClose={() => setSelectedChat(null)}
                recipientProfile={selectedChat.recipientProfile}
              />
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <div className={`${isMobileView && !selectedChat ? 'hidden' : 'flex'} flex-1 flex-col bg-white border-l border-gray-200`}>
          {selectedChat ? (
            <Chat 
              key={`${selectedChat.recipientId}-${selectedChat.recipientName}`}
              recipientId={selectedChat.recipientId}
              recipientName={selectedChat.recipientName}
              hideHeader={false}
              onClose={() => setSelectedChat(null)}
              recipientProfile={selectedChat.recipientProfile}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a conversation</h3>
                <p className="text-sm text-gray-500">Choose a chat from the sidebar to start messaging</p>
              </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}