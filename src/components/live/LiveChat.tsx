'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Flag, Shield, Ban, Eye, EyeOff, MessageSquare, MessageSquareOff, Settings } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: any;
  isModerated?: boolean;
  isCommand?: boolean;
}

interface LiveChatProps {
  streamId: string;
  hideControls?: boolean;
}

export default function LiveChat({ streamId, hideControls = false }: LiveChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isModerator, setIsModerator] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatVisibility, setChatVisibility] = useState<'public' | 'private'>('public');
  const [showCommands, setShowCommands] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Listen for real-time updates to stream settings
    const streamRef = doc(db, 'streams', streamId);
    const unsubscribeStream = onSnapshot(streamRef, (streamDoc) => {
      if (streamDoc.exists()) {
        const streamData = streamDoc.data();
        setIsModerator(streamData.userId === user.uid);
        setChatEnabled(streamData.chatEnabled ?? true);
        setChatVisibility(streamData.chatVisibility ?? 'public');
        setShowCommands(streamData.showCommands ?? true);
      }
    }, (error) => {
      console.error('Error listening to stream settings:', error);
    });

    // Listen for real-time updates to chat messages
    const q = query(
      collection(db, `streams/${streamId}/chat`),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const unsubscribeChat = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(newMessages.reverse());
    });

    return () => {
      unsubscribeStream();
      unsubscribeChat();
    };
  }, [streamId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;

    try {
      // Get the user's document from Firestore to ensure we have the latest display name
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      
      const isCommand = newMessage.trim().startsWith('/');
      await addDoc(collection(db, `streams/${streamId}/chat`), {
        userId: user.uid,
        username: userData?.displayName || user.displayName || 'Anonymous',
        message: newMessage.trim(),
        timestamp: serverTimestamp(),
        isModerated: false,
        isCommand
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const moderateMessage = async (messageId: string, action: 'delete' | 'ban') => {
    if (!isModerator) return;

    try {
      if (action === 'delete') {
        await deleteDoc(doc(db, `streams/${streamId}/chat`, messageId));
        toast({
          title: 'Message deleted',
          description: 'The message has been removed from the chat.',
        });
      } else if (action === 'ban') {
        // Here you would implement user banning logic
        toast({
          title: 'User banned',
          description: 'The user has been banned from the chat.',
        });
      }
    } catch (error) {
      console.error('Error moderating message:', error);
      toast({
        title: 'Error',
        description: 'Failed to moderate message. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const toggleAllowChat = async () => {
    if (!isModerator) return;
    try {
      const newChatEnabled = !chatEnabled;
      await updateDoc(doc(db, 'streams', streamId), {
        chatEnabled: newChatEnabled
      });
      setChatEnabled(newChatEnabled);
      toast({
        title: 'Chat setting updated',
        description: `Allow Chat is now ${newChatEnabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error updating allow chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to update allow chat. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleChatVisibilityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!isModerator) return;
    const newVisibility = e.target.value as 'public' | 'private';
    try {
      await updateDoc(doc(db, 'streams', streamId), {
        chatVisibility: newVisibility
      });
      setChatVisibility(newVisibility);
      toast({
        title: 'Chat visibility updated',
        description: `Chat is now ${newVisibility === 'public' ? 'visible to all' : 'visible for me'}`,
      });
    } catch (error) {
      console.error('Error updating chat visibility:', error);
      toast({
        title: 'Error',
        description: 'Failed to update chat visibility. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // If chat is disabled and user is not the moderator, show a message instead of hiding the chat
  if (!chatEnabled && !isModerator) {
    return (
      <div className="flex flex-col h-full rounded-lg shadow-lg bg-gradient-to-br from-[#3a3a7a] via-[#7c5fe6] to-[#c299fc] text-white">
        <div className="flex-1 flex items-center justify-center p-6 text-center text-gray-200">
          Chat is unavailable unless the streamer enables it.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-lg shadow-lg bg-gradient-to-br from-[#3a3a7a] via-[#7c5fe6] to-[#c299fc] text-white">
      {/* Chat Header */}
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white">Live Chat</h3>
          <div className="flex items-center gap-2">
            {isModerator && !hideControls && (
              <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:text-blue-400 bg-white/10 hover:bg-white/20 rounded-full shadow transition-all duration-150" aria-label="Chat Settings">
                    <Settings className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="bg-gradient-to-br from-white via-[#f3eaff] to-[#e0d7ff] dark:from-gray-900 dark:via-[#2d2250] dark:to-[#3a2a6a] text-black dark:text-white border-0 shadow-2xl rounded-xl w-44 px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-semibold text-[#6B3BFF] dark:text-[#c299fc] mb-0.5">Chat Settings</div>
                    <div className="border-b border-[#e0d7ff] dark:border-[#3a2a6a] mb-1" />
                    <div className="flex items-center gap-2 pl-1">
                      <Switch id="allow-chat" checked={chatEnabled} onCheckedChange={toggleAllowChat} className="scale-75" />
                      <Label htmlFor="allow-chat" className="text-xs font-medium leading-tight">Allow Chat</Label>
                    </div>
                    <div className="flex items-center gap-2 pl-1">
                      <Label htmlFor="chat-visibility" className="text-xs font-medium leading-tight">Chat Visibility:</Label>
                      <select
                        id="chat-visibility"
                        value={chatVisibility}
                        onChange={handleChatVisibilityChange}
                        className="bg-white dark:bg-[#2d2250] border border-[#c299fc] rounded-lg px-4 py-0.5 text-xs text-black dark:text-white focus:ring-2 focus:ring-[#a259e6] transition h-6 min-w-[90px]"
                        style={{ minWidth: '90px' }}
                      >
                        <option value="public">for all</option>
                        <option value="private">for me</option>
                      </select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {isModerator && !hideControls && (
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Shield className="w-4 h-4" />
                <span>Moderator Mode</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Separator Line */}
      <div className="border-b border-gray-200"></div>
      
      {/* Messages Container */}
      {isModerator && settingsOpen ? (
        // If the streamer/moderator is changing chat settings, hide messages
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-center text-gray-400">
          {/* No messages shown while settings are open */}
        </div>
      ) : chatVisibility === 'public' || isModerator ? (
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1 bg-white border-r border-gray-200" style={{ border: '2px solid green', backgroundColor: 'rgba(0, 255, 0, 0.1)' }}>
          {messages.map((message) => {
            // Skip commands if showCommands is false
            if (!showCommands && message.isCommand) {
              return null;
            }
            const isOwn = message.userId === user?.uid;
            return (
              <div
                key={message.id}
                className={`flex w-full mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`relative group rounded-2xl px-3 py-1.5 border shadow transition-all duration-200 chat-message-bubble
                    ${isOwn
                      ? 'text-white shadow-sm'
                      : 'bg-gray-100 text-black border-gray-100 shadow-sm'}
                  `}
                  style={{
                    ...(isOwn ? { backgroundColor: '#0F77FF', borderColor: '#0F77FF' } : {}),
                    maxWidth: '65%'
                  }}
                >
                  <div className="text-xs font-medium mb-0.5">
                    {message.username}
                  </div>
                  <div className="text-xs break-words leading-tight">{message.message}</div>
                </div>
                {/* Moderation Controls */}
                {isModerator && message.userId !== user?.uid && (
                  <div className="absolute right-0 top-0 hidden group-hover:flex space-x-1">
                    <Button
                      className="h-5 w-5 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => moderateMessage(message.id, 'delete')}
                    >
                      <Flag className="h-3 w-3" />
                    </Button>
                    <Button
                      className="h-5 w-5 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => moderateMessage(message.id, 'ban')}
                    >
                      <Ban className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      ) : (
        // If chat is private and user is not moderator, show only own messages and a notice
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-center text-gray-400">
          <div className="mb-2">Only you and the streamer can see your messages.</div>
          {messages.filter(m => m.userId === user?.uid).map((message) => (
            <div
              key={message.id}
              className="flex w-full justify-end"
            >
              <div className="relative group max-w-[80%] rounded-lg px-3 py-1.5 border shadow transition-all duration-200 bg-white/80 text-[#23235b] border-[#a259e6] shadow-blue-100">
                <div className="text-xs font-medium mb-0.5">
                  {message.username}
                </div>
                <div className="text-xs break-words leading-tight">{message.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Message Input */}
      {chatEnabled || isModerator ? (
        <form onSubmit={sendMessage} className="p-4 border-t dark:border-gray-700">
          <div className="flex space-x-2">
            <Input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 text-black bg-white border border-blue-200 rounded-full px-4 py-2 focus:ring-2 focus:ring-blue-400 focus:outline-none shadow"
              style={{ color: '#1A1A1A' }}
              disabled={!chatEnabled && !isModerator}
            />
            <Button
              type="submit"
              className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg flex items-center justify-center hover:scale-105 hover:from-purple-500 hover:to-blue-500 focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all duration-150"
              disabled={!newMessage.trim() || (!chatEnabled && !isModerator)}
            >
              <Send size={22} />
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
} 