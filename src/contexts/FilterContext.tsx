'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface FilterContextType {
  hideLockedPosts: boolean;
  setHideLockedPosts: (value: boolean) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [hideLockedPosts, setHideLockedPosts] = useState(false);

  return (
    <FilterContext.Provider value={{ hideLockedPosts, setHideLockedPosts }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}

