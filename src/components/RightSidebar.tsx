'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Link from 'next/link';
import { MessagePopup } from './messages/MessagePopup';
import { UserProfile } from '@/lib/types/user';
import { Button } from '@/components/ui/button';
import { FiMessageSquare } from 'react-icons/fi';
import { SuggestedCreators } from '@/components/sidebar/SuggestedCreators';

interface RightSidebarProps {
  suggestedCreators: UserProfile[];
  trendingTopics: { id: string; name: string; postCount: number }[];
  isLoading: boolean;
}

export function RightSidebar({ suggestedCreators, trendingTopics, isLoading }: RightSidebarProps) {
  const [isMessagePopupOpen, setIsMessagePopupOpen] = useState(false);

  return (
    <div className="w-full bg-white p-4 lg:p-6 space-y-6 lg:space-y-8">
      <SuggestedCreators />

      <MessagePopup
        isOpen={isMessagePopupOpen}
        onClose={() => setIsMessagePopupOpen(false)}
      />
    </div>
  );
} 