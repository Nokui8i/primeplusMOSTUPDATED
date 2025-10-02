'use client';

import { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function MessagesHeader() {
  const router = useRouter();

  const handleSearch = () => {
    // TODO: Implement search functionality
    console.log('Search clicked');
  };

  return (
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
      </div>
    </div>
  );
} 