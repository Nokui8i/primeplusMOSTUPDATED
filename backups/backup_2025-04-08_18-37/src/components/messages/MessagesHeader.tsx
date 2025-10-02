'use client';

import { useState } from 'react';
import { ArrowLeft, Search, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MessagePopup } from './MessagePopup';

export function MessagesHeader() {
  const router = useRouter();
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);

  const handleSearch = () => {
    // TODO: Implement search functionality
    console.log('Search clicked');
  };

  const handleNewMessage = () => {
    setIsNewMessageOpen(true);
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">MESSAGES</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleSearch}>
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNewMessage}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {isNewMessageOpen && (
        <MessagePopup
          onClose={() => setIsNewMessageOpen(false)}
        />
      )}
    </>
  );
} 