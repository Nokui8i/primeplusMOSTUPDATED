import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Image as ImageIcon, Video, Smile, Mic, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { EmojiPicker } from './EmojiPicker';

interface ChatComposerProps {
  onSend: (message: string, files?: File[], type?: string) => void;
  disabled?: boolean;
  uploading?: boolean;
  recording?: boolean;
}

export function ChatComposer({ onSend, disabled, uploading, recording }: ChatComposerProps) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim() && selectedFiles.length === 0) return;
    onSend(message, selectedFiles);
    setMessage('');
    setSelectedFiles([]);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setSelectedFiles(files);
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <form onSubmit={handleSend} className="flex gap-2 items-center p-2 border-t bg-white/80 backdrop-blur-lg">
      {/* Dropdown for Media & Emoji Buttons */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-blue-400">
            <Smile className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-white">
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-blue-400" /> Image
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowEmojiPicker(true)} className="flex items-center gap-2">
            <Smile className="h-4 w-4 text-yellow-500" /> Emoji
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleImageChange}
        style={{ display: 'none' }}
        disabled={uploading}
      />
      {/* Message Input */}
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 text-[#1A1A1A] placeholder:text-blue-400 bg-white/90 border border-blue-200 focus:ring-2 focus:ring-[#6B3BFF] focus:border-[#2B55FF] rounded-xl text-sm"
        disabled={uploading || recording}
      />
      {/* Send button */}
      <Button type="submit" size="icon" className="bg-white text-[#2B55FF] h-8 w-8 shadow hover:bg-[#6B3BFF]/10 focus:outline-none border border-blue-200" disabled={uploading || (!message.trim() && selectedFiles.length === 0)}>
        <Send className="h-4 w-4" />
      </Button>
      {/* Emoji Picker Modal */}
      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </form>
  );
} 