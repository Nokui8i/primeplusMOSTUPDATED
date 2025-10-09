"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatList } from '@/components/chat/ChatList';
import { Chat } from '@/components/chat/Chat';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Search, MessageCircle, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useChat } from '@/contexts/ChatContext';

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const { markAsRead } = useChat();
  const [selectedChat, setSelectedChat] = useState<{
    recipientId: string;
    recipientName: string;
  } | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread'>('all');

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
    console.log('🔍 Selecting chat:', recipientId, recipientName);
    setSelectedChat({ recipientId, recipientName });
    console.log('🔍 Calling markAsRead for:', recipientId);
    markAsRead(recipientId);
  };

  return (
    <div className="flex bg-white rounded-lg shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Left Column - Chat List */}
      <div className={`${isMobileView ? (!selectedChat ? 'flex' : 'hidden') : 'flex'} w-80 flex-col bg-white border-r border-gray-200`}>
        {/* Header */}
        <div className="px-4 py-1.5 overflow-hidden border-b border-gray-200">
          {/* Search Bar and Filter Dropdown */}
          <div className="flex gap-3 justify-between">
            {/* Animated Search Bar */}
            <div className="relative flex-1 ml-2">
              <style jsx>{`
                .search-container {
                  position: relative !important;
                  --size-button: 32px;
                  color: white;
                  top: -2px !important;
                }
                
                .search-input {
                  padding-left: var(--size-button) !important;
                  height: var(--size-button) !important;
                  font-size: 13px !important;
                  border: none !important;
                  color: #000 !important;
                  outline: none !important;
                  width: var(--size-button) !important;
                  transition: all ease 0.3s !important;
                  background-color: #fff !important;
                  box-shadow: 1.5px 1.5px 3px #e5e7eb, -1.5px -1.5px 3px rgba(156, 163, 175, 0.25), inset 0px 0px 0px #e5e7eb, inset 0px -0px 0px rgba(156, 163, 175, 0.25) !important;
                  border-radius: 50px !important;
                  cursor: pointer !important;
                  margin: 0 !important;
                  padding-top: 0 !important;
                  padding-bottom: 0 !important;
                  padding-right: 0 !important;
                }
                
                .search-input:focus,
                .search-input:not(:invalid) {
                  width: 150px !important;
                  cursor: text !important;
                  border: none !important;
                  outline: none !important;
                  box-shadow: 0px 0px 0px #e5e7eb, 0px 0px 0px rgba(156, 163, 175, 0.25), inset 1.5px 1.5px 3px #e5e7eb, inset -1.5px -1.5px 3px rgba(156, 163, 175, 0.25) !important;
                }
                
                .search-input:focus + .search-icon,
                .search-input:not(:invalid) + .search-icon {
                  pointer-events: all !important;
                  cursor: pointer !important;
                }
                
                .search-icon {
                  position: absolute !important;
                  width: var(--size-button) !important;
                  height: var(--size-button) !important;
                  top: -2px !important;
                  left: 1px !important;
                  padding: 6px !important;
                  pointer-events: none !important;
                }
                
                .search-icon svg {
                  width: 100% !important;
                  height: 100% !important;
                }
              `}</style>
              <div className="search-container">
                <input
                  type="text"
                  name="search"
                  className="search-input"
                  required
                  placeholder="Type to search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="search-icon">
                  <Search className="w-full h-full text-gray-500" />
                </div>
              </div>
            </div>

            {/* Filter Dropdown */}
            <div className="mr-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-2 py-1 rounded-full flex items-center gap-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition-all duration-200 focus:outline-none focus:ring-0">
                  <span className="text-xs font-medium">
                    {filterType === 'all' ? 'All' : 'Unread'}
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
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-hidden">
          <ChatList 
            onSelectChat={handleSelectChat} 
            searchQuery={searchQuery}
            filterType={filterType}
          />
        </div>
      </div>

      {/* Right Column - Chat Area */}
      <div className={`${isMobileView && !selectedChat ? 'hidden' : 'flex'} flex-1 flex-col bg-white`}>
        {selectedChat ? (
          <Chat 
            recipientId={selectedChat.recipientId} 
            recipientName={selectedChat.recipientName} 
            hideHeader={false} 
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
    </div>
  );
}
