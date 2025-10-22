'use client';

import { useChat } from '@/contexts/ChatContext';
import { ChatPopup } from './ChatPopup';
import { usePathname } from 'next/navigation';

export function ChatWindows() {
  const { chatWindows } = useChat();
  const pathname = usePathname();


  // Don't show chat windows if there are no open chats
  if (chatWindows.length === 0) {
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