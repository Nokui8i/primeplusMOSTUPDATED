'use client';

import { useChat } from '@/contexts/ChatContext';
import { ChatPopup } from './ChatPopup';
import { usePathname } from 'next/navigation';

export function ChatWindows() {
  const { chatWindows } = useChat();
  const pathname = usePathname();


  // Don't show chat on login/register pages
  if (pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/complete-profile') {
    return null;
  }

  return (
    <>
      {chatWindows.map((window) => (
        <ChatPopup
          key={window.id}
          user={window.user}
          position={window.position}
          isMinimized={window.isMinimized}
          unreadCount={window.unreadCount}
        />
      ))}
    </>
  );
} 