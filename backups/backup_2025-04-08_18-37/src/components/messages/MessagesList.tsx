'use client';

import { useEffect, useState, useRef } from 'react';
import { Message, Thread } from '@/lib/types/messages';
import { messagesService } from '@/lib/services/messages';
import { useAuth } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { Skeleton } from '../ui/skeleton';
import { FiDownload, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';

interface MessagesListProps {
  threadId: string;
  filter: 'all' | 'unread';
  sortBy: 'newest' | 'oldest';
}

export function MessagesList({ threadId, filter, sortBy }: MessagesListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver>();
  const loadingRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load initial messages and setup real-time updates
  useEffect(() => {
    if (!threadId || !user) return;

    setLoading(true);
    
    // Load initial messages
    const loadMessages = async () => {
      try {
        const initialMessages = await messagesService.getMessages(threadId);
        setMessages(initialMessages);
        setLoading(false);
        scrollToBottom();
      } catch (error) {
        console.error('Error loading messages:', error);
        toast({
          title: 'Error loading messages',
          description: 'Please try again later',
          variant: 'destructive',
        });
        setLoading(false);
      }
    };

    // Subscribe to new messages
    const unsubscribe = messagesService.subscribeToMessages(threadId, (updatedMessages) => {
      setMessages(updatedMessages);
      if (updatedMessages.length > messages.length) {
        scrollToBottom();
      }
    });

    // Mark messages as read
    const markAsRead = async () => {
      try {
        await messagesService.markMessagesAsRead(threadId, user.uid);
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };

    loadMessages();
    markAsRead();

    return () => {
      unsubscribe();
    };
  }, [threadId, user, toast]);

  // Setup infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMoreMessages();
        }
      },
      { threshold: 0.5 }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading]);

  // Load more messages
  const loadMoreMessages = async () => {
    if (!messages.length) return;

    try {
      const lastMessage = messages[messages.length - 1];
      const moreMessages = await messagesService.getMessages(threadId, lastMessage.timestamp);
      
      if (moreMessages.length < 20) {
        setHasMore(false);
      }
      
      setMessages((prev) => [...prev, ...moreMessages]);
    } catch (error) {
      console.error('Error loading more messages:', error);
      toast({
        title: 'Error loading more messages',
        description: 'Please try again later',
        variant: 'destructive',
      });
    }
  };

  // Handle message deletion
  const handleDeleteMessage = async (messageId: string) => {
    try {
      await messagesService.deleteMessage(messageId);
      toast({
        title: 'Message deleted',
        description: 'The message has been deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: 'Error deleting message',
        description: 'Please try again later',
        variant: 'destructive',
      });
    }
  };

  // Handle message editing
  const handleEditMessage = async (messageId: string) => {
    if (!editContent.trim()) return;

    try {
      await messagesService.editMessage(messageId, editContent);
      setEditingMessageId(null);
      setEditContent('');
      toast({
        title: 'Message updated',
        description: 'The message has been updated successfully',
      });
    } catch (error) {
      console.error('Error editing message:', error);
      toast({
        title: 'Error updating message',
        description: 'Please try again later',
        variant: 'destructive',
      });
    }
  };

  // Filter and sort messages
  const filteredMessages = messages
    .filter((message) => filter === 'all' || message.status !== 'read')
    .sort((a, b) => {
      const comparison = a.timestamp.seconds - b.timestamp.seconds;
      return sortBy === 'newest' ? -comparison : comparison;
    });

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Load more trigger */}
      {hasMore && (
        <div ref={loadingRef} className="text-center">
          <Skeleton className="h-8 w-24 mx-auto" />
        </div>
      )}

      {/* Messages */}
      {filteredMessages.map((message) => (
        <div
          key={message.id}
          className={`flex items-start gap-4 ${
            message.senderId === user?.uid ? 'flex-row-reverse' : ''
          }`}
        >
          {/* User Avatar */}
          <div className="w-10 h-10 rounded-full bg-gray-100 relative overflow-hidden">
            {message.senderId === user?.uid ? (
              <Image
                src={user.photoURL || '/default-avatar.png'}
                alt="Your avatar"
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                {message.senderId.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Message Content */}
          <div className={`flex-1 space-y-1 ${
            message.senderId === user?.uid ? 'items-end' : 'items-start'
          }`}>
            {/* Message Header */}
            <div className={`flex items-center gap-2 ${
              message.senderId === user?.uid ? 'justify-end' : ''
            }`}>
              <span className="text-sm text-gray-500">
                {formatDistanceToNow(message.timestamp.toDate(), { addSuffix: true })}
              </span>
              {message.editedAt && (
                <span className="text-xs text-gray-400">(edited)</span>
              )}
            </div>

            {/* Message Bubble */}
            <div className={`rounded-lg p-3 max-w-[80%] ${
              message.senderId === user?.uid
                ? 'bg-pink-50 ml-auto'
                : 'bg-gray-100'
            }`}>
              {editingMessageId === message.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-2 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-200"
                    rows={3}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingMessageId(null);
                        setEditContent('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleEditMessage(message.id)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap break-words">
                    {message.isDeleted ? (
                      <span className="italic text-gray-400">
                        This message was deleted
                      </span>
                    ) : (
                      message.content
                    )}
                  </p>
                  
                  {/* Attachments */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {message.attachments.map((attachment, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 rounded bg-white/50"
                        >
                          <span className="flex-1 truncate">{attachment.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(attachment.url, '_blank')}
                          >
                            <FiDownload className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Message Actions */}
            {message.senderId === user?.uid && !message.isDeleted && !editingMessageId && (
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setEditingMessageId(message.id);
                    setEditContent(message.content);
                  }}
                >
                  <FiEdit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-red-500 hover:text-red-600"
                  onClick={() => handleDeleteMessage(message.id)}
                >
                  <FiTrash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Scroll to bottom marker */}
      <div ref={messagesEndRef} />
    </div>
  );
} 