"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface UserList {
  name: string;
  count: number;
  users: any[];
}

interface SubscriptionsContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  userLists: UserList[];
  setUserLists: (lists: UserList[]) => void;
  selectedList: string;
  setSelectedList: (list: string) => void;
}

const SubscriptionsContext = createContext<SubscriptionsContextType | undefined>(undefined);

interface SubscriptionsProviderProps {
  children: ReactNode;
}

export function SubscriptionsProvider({ children }: SubscriptionsProviderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [userLists, setUserLists] = useState<UserList[]>([
    { name: 'Subscribed', count: 0, users: [] },
    { name: 'Expired', count: 0, users: [] },
  ]);
  const [selectedList, setSelectedList] = useState('Subscribed');

  return (
    <SubscriptionsContext.Provider value={{ 
      searchQuery, 
      setSearchQuery,
      userLists,
      setUserLists,
      selectedList,
      setSelectedList
    }}>
      {children}
    </SubscriptionsContext.Provider>
  );
}

export function useSubscriptions() {
  const context = useContext(SubscriptionsContext);
  if (context === undefined) {
    throw new Error('useSubscriptions must be used within a SubscriptionsProvider');
  }
  return context;
}

