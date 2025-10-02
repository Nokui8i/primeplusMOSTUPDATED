"use client";

import { useEffect, useState } from 'react';
import { MessagesHeader } from '@/components/messages/MessagesHeader';
import { MessagesFilter } from '@/components/messages/MessagesFilter';
import { MessagesList } from '@/components/messages/MessagesList';
import { MessagesEmptyState } from '@/components/messages/MessagesEmptyState';
import { Thread } from '@/lib/types/messages';
import { messagesService } from '@/lib/services/messages';
import { useAuth } from '@/lib/auth';

export default function MessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Subscribe to user's threads
    const unsubscribe = messagesService.subscribeToUserThreads(user.uid, (updatedThreads) => {
      setThreads(updatedThreads);
      setLoading(false);

      // Select the first thread if none is selected
      if (!selectedThreadId && updatedThreads.length > 0) {
        setSelectedThreadId(updatedThreads[0].id);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, selectedThreadId]);

  // Filter and sort threads
  const filteredThreads = threads
    .filter((thread) => {
      if (filter === 'all') return true;
      return (thread.unreadCount[user?.uid || ''] || 0) > 0;
    })
    .sort((a, b) => {
      const comparison = (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
      return sortBy === 'newest' ? comparison : -comparison;
    });

  return (
    <div className="flex flex-col h-screen">
      <MessagesHeader />
      <MessagesFilter 
        filter={filter} 
        onFilterChange={setFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />
      
      <div className="flex-1 flex">
        {/* Threads List */}
        <div className="w-80 border-r border-[#EEEEEE] overflow-y-auto">
          {filteredThreads.map((thread) => {
            const otherParticipant = thread.participants.find(id => id !== user?.uid);
            return (
              <button
                key={thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                  thread.id === selectedThreadId ? 'bg-pink-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{otherParticipant}</span>
                  {thread.unreadCount[user?.uid || ''] > 0 && (
                    <span className="bg-pink-500 text-white text-xs px-2 py-1 rounded-full">
                      {thread.unreadCount[user?.uid || '']}
                    </span>
                  )}
                </div>
                {thread.lastMessage && (
                  <p className="text-sm text-gray-500 truncate">
                    {thread.lastMessage.content}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Messages */}
        <div className="flex-1">
          {selectedThreadId ? (
            <MessagesList
              threadId={selectedThreadId}
              filter={filter}
              sortBy={sortBy}
            />
          ) : (
            <MessagesEmptyState />
          )}
        </div>
      </div>
    </div>
  );
} 