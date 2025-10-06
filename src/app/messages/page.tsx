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

export default function MessagesPage() {
  const searchParams = useSearchParams();
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
    setSelectedChat({ recipientId, recipientName });
  };

  return (
    <div className="flex h-full bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Left Column - Chat List */}
      <div className={`${isMobileView ? (!selectedChat ? 'flex' : 'hidden') : 'flex'} w-80 flex-col bg-white border-r border-gray-200`}>
        {/* Header */}
        <div className="px-2 py-0.5 border-b border-gray-200">
          {/* Search Bar and Filter Dropdown */}
          <div className="flex gap-3">
            {/* Animated Search Bar */}
            <div className="relative flex-1">
              <style jsx>{`
                .search-container {
                  position: relative;
                  --size-button: 32px;
                  color: white;
                }
                
                .search-input {
                  padding-left: var(--size-button);
                  height: var(--size-button);
                  font-size: 13px;
                  border: none;
                  color: #000;
                  outline: none;
                  width: var(--size-button);
                  transition: all ease 0.3s;
                  background-color: #fff;
                  box-shadow: 1.5px 1.5px 3px #e5e7eb, -1.5px -1.5px 3px rgba(156, 163, 175, 0.25), inset 0px 0px 0px #e5e7eb, inset 0px -0px 0px rgba(156, 163, 175, 0.25);
                  border-radius: 50px;
                  cursor: pointer;
                }
                
                .search-input:focus,
                .search-input:not(:invalid) {
                  width: 150px;
                  cursor: text;
                  box-shadow: 0px 0px 0px #e5e7eb, 0px 0px 0px rgba(156, 163, 175, 0.25), inset 1.5px 1.5px 3px #e5e7eb, inset -1.5px -1.5px 3px rgba(156, 163, 175, 0.25);
                }
                
                .search-input:focus + .search-icon,
                .search-input:not(:invalid) + .search-icon {
                  pointer-events: all;
                  cursor: pointer;
                }
                
                .search-icon {
                  position: absolute;
                  width: var(--size-button);
                  height: var(--size-button);
                  top: -1px;
                  left: 1px;
                  padding: 6px;
                  pointer-events: none;
                }
                
                .search-icon svg {
                  width: 100%;
                  height: 100%;
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-black hover:text-black hover:bg-transparent">
                  <span className="text-sm">
                    {filterType === 'all' ? 'All' : 'Unread'}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-20 bg-white border border-gray-200 shadow-lg">
                <DropdownMenuItem 
                  onClick={() => setFilterType('all')}
                  className={`text-xs py-0.5 bg-white hover:bg-gray-50 cursor-pointer ${
                    filterType === 'all' ? 'text-blue-600' : 'text-gray-700'
                  }`}
                >
                  All
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setFilterType('unread')}
                  className={`text-xs py-0.5 bg-white hover:bg-gray-50 cursor-pointer ${
                    filterType === 'unread' ? 'text-blue-600' : 'text-gray-700'
                  }`}
                >
                  Unread
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
      <div className={`${isMobileView && !selectedChat ? 'hidden' : 'flex'} flex-1 flex-col bg-gray-50`}>
        {selectedChat ? (
          <Chat 
            recipientId={selectedChat.recipientId} 
            recipientName={selectedChat.recipientName} 
            hideHeader={true} 
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
