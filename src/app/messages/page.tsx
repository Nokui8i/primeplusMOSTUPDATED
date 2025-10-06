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

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const [selectedChat, setSelectedChat] = useState<{
    recipientId: string;
    recipientName: string;
  } | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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
                  className="search-input"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="search-icon">
                  <Search className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="h-8 px-2 text-gray-600 hover:text-gray-900 hover:bg-transparent"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              
              {isFilterOpen && (
                <div className="absolute right-0 top-9 z-50 w-32 bg-white rounded-xl shadow-lg border border-gray-200 py-1 transform transition-all duration-200 ease-out"
                     style={{
                       boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                       filter: 'drop-shadow(0 10px 8px rgba(0, 0, 0, 0.04)) drop-shadow(0 4px 3px rgba(0, 0, 0, 0.1))'
                     }}>
                  <button
                    onClick={() => {
                      setFilterType('all');
                      setIsFilterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      filterType === 'all' ? 'text-gray-900 font-medium' : 'text-gray-600'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => {
                      setFilterType('unread');
                      setIsFilterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      filterType === 'unread' ? 'text-gray-900 font-medium' : 'text-gray-600'
                    }`}
                  >
                    Unread
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          <ChatList 
            onSelectChat={handleSelectChat}
            searchQuery={searchQuery}
            filterType={filterType}
          />
        </div>
      </div>

      {/* Right Column - Chat Area */}
      <div className={`${isMobileView ? (selectedChat ? 'flex' : 'hidden') : 'flex'} flex-1 flex-col`}>
        {selectedChat ? (
          <Chat
            recipientId={selectedChat.recipientId}
            recipientName={selectedChat.recipientName}
            onBack={() => setSelectedChat(null)}
            isMobileView={isMobileView}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No chat selected</h3>
              <p className="text-gray-500">Choose a conversation from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}