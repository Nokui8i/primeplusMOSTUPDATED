import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, where, doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { MessagesAvatar } from '@/components/ui/MessagesAvatar';
import { Button } from '@/components/ui/button';
import { Trash2, MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface ChatMetadata {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientPhotoURL?: string | null;
  lastMessage: string;
  lastMessageTime: any;
  unreadCount: number;
}


interface ChatListProps {
  onSelectChat: (recipientId: string, recipientName: string) => void;
  searchQuery?: string;
  filterType?: 'all' | 'unread';
}

export function ChatList({ onSelectChat, searchQuery = '', filterType = 'all' }: ChatListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<ChatMetadata[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatMetadata[]>([]);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!user || !user.uid) return;

    const fetchChats = async () => {
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', user.uid),
        orderBy('lastMessageTime', 'desc')
      );

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        console.log('Chats snapshot received:', snapshot.docs.length, 'chats');
        const chatPromises = snapshot.docs.map(async (chatDoc) => {
          const data = chatDoc.data();
          const participants = data.participants || [];
          const otherUserId = participants.find((id: string) => id !== user.uid);
          
          if (!otherUserId) return null;

          // Get user info
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          const userData = userDoc.exists() ? userDoc.data() : {};
          
          return {
            id: chatDoc.id,
            recipientId: otherUserId,
            recipientName: userData.displayName || userData.username || 'Unknown User',
            recipientPhotoURL: userData.photoURL,
            lastMessage: data.lastMessage || '',
            lastMessageTime: data.lastMessageTime,
            unreadCount: data.unreadCounts?.[user.uid] || 0
          };
        });

        const chatResults = await Promise.all(chatPromises);
        const validChats = chatResults.filter(chat => chat !== null) as ChatMetadata[];
        console.log('Valid chats found:', validChats.length, validChats);
        setChats(validChats);
      });

      return () => unsubscribe();
    };

    fetchChats();
  }, [user, deletingChatId]);

  // Filter chats based on search query and filter type
  useEffect(() => {
    let filtered = chats;

    // Apply filter type
    if (filterType === 'unread') {
      filtered = filtered.filter(chat => chat.unreadCount > 0);
    }

    // Apply search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(chat => 
        chat.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredChats(filtered);
  }, [chats, filterType, searchQuery]);


  const handleDeleteChat = async () => {
    if (!chatToDelete) return;

    setDeletingChatId(chatToDelete.id);
    try {
      // Delete all messages in the chat
      const messagesRef = collection(db, 'chats', chatToDelete.id, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Delete chat
      await deleteDoc(doc(db, 'chats', chatToDelete.id));

      toast({
        title: "Chat deleted",
        description: "The chat has been successfully deleted.",
      });
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: "Error",
        description: "Failed to delete the chat. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingChatId(null);
      setChatToDelete(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">
              {filterType === 'unread' ? 'No unread messages' : 'No conversations yet'}
            </h3>
            <p className="text-sm mb-4">
              {filterType === 'unread' ? 'All messages have been read' : 'Start a new conversation to begin messaging'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                className="group flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onSelectChat(chat.recipientId, chat.recipientName)}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <MessagesAvatar 
                    src={chat.recipientPhotoURL || '/default-avatar.png'}
                    alt={chat.recipientName}
                    fallback={chat.recipientName[0]}
                    size="md"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                </div>

                {/* Chat Info */}
                <div className="flex-1 min-w-0">
                  {/* Name Row */}
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate flex-1 min-w-0">
                      {chat.recipientName || chat.recipientId || 'Unknown User'}
                    </h3>
                    <div className="flex items-center gap-1 ml-2">
                      {chat.lastMessageTime && (
                        <span className="text-xs text-gray-500">
                          {new Date(chat.lastMessageTime.toDate?.() || chat.lastMessageTime).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      )}
                      {chat.unreadCount > 0 && (
                        <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[18px] text-center">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Message Row */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-600 truncate flex-1 min-w-0">
                      {chat.lastMessage || 'No messages yet'}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatToDelete({ id: chat.id, name: chat.recipientName });
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                      disabled={deletingChatId === chat.id}
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!chatToDelete} onOpenChange={() => setChatToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete the chat with {chatToDelete?.name}? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setChatToDelete(null)}
                disabled={deletingChatId === chatToDelete?.id}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteChat}
                disabled={deletingChatId === chatToDelete?.id}
              >
                {deletingChatId === chatToDelete?.id ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}