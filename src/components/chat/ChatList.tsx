import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, where, doc, setDoc, getDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
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
        const chatPromises = snapshot.docs.map(async (chatDoc) => {
          const data = chatDoc.data();
          const participants = data.participants || [];
          const otherUserId = participants.find((id: string) => id !== user.uid);
          
          if (!otherUserId) return null;

          // Get user info
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          const userData = userDoc.exists() ? userDoc.data() : {};
          
          // If no lastMessage in metadata, get it from the actual messages
          let lastMessage = data.lastMessage || '';
          let lastMessageTime = data.lastMessageTime;
          
          if (!lastMessage) {
            try {
              const messagesRef = collection(db, 'chats', chatDoc.id, 'messages');
              const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), where('timestamp', '!=', null));
              const messagesSnapshot = await getDocs(messagesQuery);
              
              if (!messagesSnapshot.empty) {
                const lastMsg = messagesSnapshot.docs[0].data();
                lastMessage = lastMsg.text || (lastMsg.imageUrl ? '📷 Image' : lastMsg.videoUrl ? '🎥 Video' : lastMsg.audioUrl ? '🎵 Voice message' : '');
                lastMessageTime = lastMsg.timestamp;
                
                // Update the chat metadata with the found last message
                await updateDoc(chatDoc.ref, {
                  lastMessage: lastMessage,
                  lastMessageTime: lastMessageTime
                });
              }
            } catch (error) {
              console.error('Error fetching last message:', error);
            }
          }
          
          const unreadCount = data.unreadCounts?.[user.uid] || 0;
          
          return {
            id: chatDoc.id,
            recipientId: otherUserId,
            recipientName: userData.displayName || userData.username || 'Unknown User',
            recipientPhotoURL: userData.photoURL,
            lastMessage: lastMessage,
            lastMessageTime: lastMessageTime,
            unreadCount: unreadCount
          };
        });

        const chatResults = await Promise.all(chatPromises);
        const validChats = chatResults.filter(chat => chat !== null) as ChatMetadata[];
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
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {chat.recipientName || chat.recipientId || 'Unknown User'}
                    </h3>
                    {chat.unreadCount > 0 && (
                      <div className="w-3 h-3 rounded-full shadow-lg flex-shrink-0" style={{
                        background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
                        boxShadow: '0 2px 8px rgba(96, 165, 250, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }} />
                    )}
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
                      <Trash2 className="h-3 w-3" style={{ color: '#3b82f6' }} />
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