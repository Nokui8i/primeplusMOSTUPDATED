"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MessagesContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterType: 'all' | 'unread' | 'pinned';
  setFilterType: (type: 'all' | 'unread' | 'pinned') => void;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

interface MessagesProviderProps {
  children: ReactNode;
}

export function MessagesProvider({ children }: MessagesProviderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'pinned'>('all');

  return (
    <MessagesContext.Provider value={{ searchQuery, setSearchQuery, filterType, setFilterType }}>
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


