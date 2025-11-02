'use client';

import { useChat } from '@/contexts/ChatContext';
import { ChatPopup } from './ChatPopup';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export function ChatWindows() {
  const { chatWindows } = useChat();
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Don't show if there are no open chats
  if (chatWindows.length === 0) {
    return null;
  }

  // Show chat windows on all devices (mobile enabled)
  return (
    <>
      {chatWindows.map((window) => (
        <ChatPopup
          key={window.id}
          user={window.user}
          position={window.position}
          isMinimized={window.isMinimized}
          unreadCount={window.unreadCount}
          isMobile={isMobile}
        />
      ))}
    </>
  );
} 