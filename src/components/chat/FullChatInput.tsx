import React, { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Image as ImageIcon, Video, Smile, Mic, X, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { EmojiPicker } from './EmojiPicker';
import { ImageUploadPreview } from './ImageUploadPreview';
import { VideoUploadPreview } from './VideoUploadPreview';
import { VoiceRecorder } from './VoiceRecorder';

interface FullChatInputProps {
  onSend: (data: {
    text: string;
    images?: { file: File, locked: boolean }[];
    videos?: { file: File, locked: boolean }[];
    audio?: Blob;
    type: 'text' | 'image' | 'video' | 'audio';
  }) => void;
  uploading?: boolean;
}

export function FullChatInput({ onSend, uploading }: FullChatInputProps) {
  const [message, setMessage] = useState('');
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSend({ text: message, type: 'text' });
    setMessage('');
  };

  const handleImageUpload = async (images: { file: File, locked: boolean }[]) => {
    onSend({ text: '', images, type: 'image' });
    setShowImageUpload(false);
    return Promise.resolve();
  };

  const handleVideoUpload = async (videos: { file: File, locked: boolean }[]) => {
    onSend({ text: '', videos, type: 'video' });
    setShowVideoUpload(false);
    return Promise.resolve();
  };

  const handleVoiceUpload = async (audio: Blob) => {
    onSend({ text: '', audio, type: 'audio' });
    setShowVoiceRecorder(false);
    return Promise.resolve();
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <>
      {/* Image Upload Preview Modal */}
      {showImageUpload && (
        <ImageUploadPreview
          onUpload={handleImageUpload}
          onCancel={() => setShowImageUpload(false)}
        />
      )}
      {/* Video Upload Preview Modal */}
      {showVideoUpload && (
        <VideoUploadPreview
          onUpload={handleVideoUpload}
          onCancel={() => setShowVideoUpload(false)}
        />
      )}
      {/* Emoji Picker Modal */}
      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
      {/* Voice Recorder Modal */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onUpload={handleVoiceUpload}
          onCancel={() => setShowVoiceRecorder(false)}
        />
      )}
      <form onSubmit={handleSend} className="p-1 md:p-2 border-t bg-white/80 backdrop-blur-lg">
        <div className="flex gap-1 md:gap-2 items-center">
          {/* Dropdown for Media & Emoji Buttons */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 md:h-8 md:w-8 text-blue-400">
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setShowImageUpload(true)} className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-blue-400" /> Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowVideoUpload(true)} className="flex items-center gap-2">
                <Video className="h-4 w-4 text-blue-400" /> Video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowEmojiPicker(true)} className="flex items-center gap-2">
                <Smile className="h-4 w-4 text-yellow-500" /> Emoji
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Message Input */}
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 text-[#1A1A1A] placeholder:text-blue-400 bg-white/90 border border-blue-200 focus:ring-2 focus:ring-[#6B3BFF] focus:border-[#2B55FF] rounded-xl text-xs md:text-sm"
            disabled={uploading || isRecording}
          />
          {message.trim() ? (
            <Button type="submit" size="icon" className="bg-white text-[#2B55FF] h-7 w-7 md:h-8 md:w-8 shadow hover:bg-[#6B3BFF]/10 focus:ring-2 focus:ring-[#6B3BFF] border border-blue-200" disabled={uploading}>
              <Send className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              className="bg-white text-[#2B55FF] h-7 w-7 md:h-8 md:w-8 shadow hover:bg-[#6B3BFF]/10 focus:ring-2 focus:ring-[#6B3BFF] border border-blue-200"
              onClick={() => setShowVoiceRecorder(true)}
              disabled={uploading}
            >
              <Mic className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          )}
        </div>
      </form>
    </>
  );
} 