"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MessagesContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterType: 'all' | 'unread' | 'pinned';
  setFilterType: (type: 'all' | 'unread' | 'pinned') => void;
  selectedChat: { recipientId: string; recipientName: string; recipientProfile?: any; sharedChatId?: string } | null;
  setSelectedChat: (chat: { recipientId: string; recipientName: string; recipientProfile?: any; sharedChatId?: string } | null) => void;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

interface MessagesProviderProps {
  children: ReactNode;
}

export function MessagesProvider({ children }: MessagesProviderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'pinned'>('all');
  const [selectedChat, setSelectedChat] = useState<{ recipientId: string; recipientName: string; recipientProfile?: any; sharedChatId?: string } | null>(null);

  return (
    <MessagesContext.Provider value={{ searchQuery, setSearchQuery, filterType, setFilterType, selectedChat, setSelectedChat }}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  const context = useContext(MessagesContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
}


