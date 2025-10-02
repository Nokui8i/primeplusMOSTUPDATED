'use client';

import { useState, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (recipient: string, message: string) => void;
}

export function NewMessageModal({ isOpen, onClose, onSend }: NewMessageModalProps) {
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (recipient.trim() && message.trim()) {
      onSend(recipient.trim(), message.trim());
      setRecipient('');
      setMessage('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Input
              placeholder="Recipient username"
              value={recipient}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRecipient(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Textarea
              placeholder="Type your message..."
              value={message}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-[#FF4081] to-[#E91E63] hover:from-[#E91E63] hover:to-[#C2185B] text-white"
            onClick={handleSend}
            disabled={!recipient.trim() || !message.trim()}
          >
            Send Message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 