'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NewMessageModal } from './NewMessageModal';

export function MessagesEmptyState() {
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);

  const handleSendMessage = async (recipient: string, message: string) => {
    try {
      // TODO: Implement sending message
      console.log('Sending message to:', recipient, message);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-semibold mb-2">
          Select any Conversation or send a New Message
        </h2>
        <Button 
          className="mt-4 bg-gradient-to-r from-[#FF4081] to-[#E91E63] hover:from-[#E91E63] hover:to-[#C2185B] text-white"
          onClick={() => setIsNewMessageOpen(true)}
        >
          NEW MESSAGE
        </Button>
      </div>

      <NewMessageModal
        isOpen={isNewMessageOpen}
        onClose={() => setIsNewMessageOpen(false)}
        onSend={handleSendMessage}
      />
    </>
  );
} 