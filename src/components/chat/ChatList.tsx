import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, where, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { MessagesAvatar } from '@/components/ui/MessagesAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Trash2, MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

interface User {
  uid: string;
  displayName: string;
  photoURL?: string;
  username?: string;
  email?: string;
}

interface ChatListProps {
  onSelectChat: (recipientId: string, recipientName: string) => void;
}

export function ChatList({ onSelectChat }: ChatListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<ChatMetadata[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatMetadata[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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
          if (deletingChatId === chatDoc.id) {
            return null;
          }

          const chatData = chatDoc.data();
          const recipientId = chatData.participants.find((id: string) => id !== user.uid);
          
          if (!recipientId) {
            return null;
          }

          // Get user data directly by ID
          const directUserRef = doc(db, 'users', recipientId);
          const directUserDoc = await getDoc(directUserRef);
          const userData = directUserDoc.exists() ? directUserDoc.data() : null;

          // Get the best available name
          const recipientName = userData?.displayName || userData?.username || userData?.email || recipientId;
          const recipientPhotoURL = userData?.photoURL || null;

          // Count unread messages
          const messagesRef = collection(db, 'chats', chatDoc.id, 'messages');
          const unreadQuery = query(
            messagesRef,
            where('senderId', '==', recipientId),
            where('read', '==', false)
          );
          const unreadSnapshot = await getDocs(unreadQuery);
          const unreadCount = unreadSnapshot.size;

          return {
            id: chatDoc.id,
            recipientId,
            recipientName,
            recipientPhotoURL,
            lastMessage: chatData.lastMessage || 'No messages yet',
            lastMessageTime: chatData.lastMessageTime || chatData.createdAt || null,
            unreadCount
          };
        });

        const chatResults = (await Promise.all(chatPromises)).filter(Boolean) as ChatMetadata[];
        
        // Deduplicate chats by recipientId, keeping the most recent one
        const dedupedChatsMap = new Map<string, ChatMetadata>();
        for (const chat of chatResults) {
          if (!dedupedChatsMap.has(chat.recipientId)) {
            dedupedChatsMap.set(chat.recipientId, chat);
          } else {
            const existing = dedupedChatsMap.get(chat.recipientId)!;
            const chatTime = chat.lastMessageTime?.toDate?.() || new Date(0);
            const existingTime = existing.lastMessageTime?.toDate?.() || new Date(0);
            if (chatTime > existingTime) {
              dedupedChatsMap.set(chat.recipientId, chat);
            }
          }
        }
        const finalChats = Array.from(dedupedChatsMap.values());
        setChats(finalChats);
      });

      return () => unsubscribe();
    };

    fetchChats();
  }, [user, deletingChatId]);

  // Filter chats based on selected filter
  useEffect(() => {
    if (filter === 'unread') {
      const unreadChats = chats.filter(chat => chat.unreadCount > 0);
      setFilteredChats(unreadChats);
    } else {
      setFilteredChats(chats);
    }
  }, [chats, filter]);

  const handleSearch = async (search: string) => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const usersRef = collection(db, 'users');
    const usersQuery = query(
      usersRef,
      where('displayName', '>=', search),
      where('displayName', '<=', search + '\uf8ff')
    );

    const snapshot = await getDocs(usersQuery);
    const results = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          displayName: data.displayName,
          photoURL: data.photoURL,
          username: data.username,
          email: data.email,
        } as User;
      })
      .filter(result => result.uid !== user?.uid); // Exclude current user

    setSearchResults(results);
    setIsSearching(false);
  };

  const startNewChat = (recipientId: string, recipientName: string) => {
    onSelectChat(recipientId, recipientName);
  };

  const handleDeleteClick = (chatId: string, chatName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatToDelete({ id: chatId, name: chatName });
  };

  const handleConfirmDelete = async () => {
    if (!chatToDelete || !user) return;

    try {
      setDeletingChatId(chatToDelete.id);
      
      // Remove from local state first
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatToDelete.id));
      
      // Delete messages
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
      const chatToRestore = chats.find(chat => chat.id === chatToDelete.id);
      if (chatToRestore) {
        setChats(prevChats => [...prevChats, chatToRestore]);
      }
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
      {/* Header for ChatList */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            Messages
          </h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-sm font-medium rounded-md">
                <Plus className="h-4 w-4 mr-1" /> New
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Start New Chat</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Input
                  type="text"
                  placeholder="Search users by name or username..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearch(e.target.value);
                  }}
                  className="mb-4"
                />
                {isSearching && <p className="text-center text-gray-500">Searching...</p>}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    {searchResults.map((result) => (
                      <div
                        key={result.uid}
                        className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md cursor-pointer"
                        onClick={() => {
                          startNewChat(result.uid, result.displayName || result.username || result.email || 'Unknown User');
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                      >
                        <MessagesAvatar
                          src={result.photoURL || '/default-avatar.png'}
                          alt={result.displayName || result.username || 'User'}
                          fallback={result.displayName?.[0] || result.username?.[0] || 'U'}
                          size="md"
                        />
                        <span className="font-medium">{result.displayName || result.username || result.email}</span>
                      </div>
                    ))}
                  </div>
                )}
                {searchQuery.length > 0 && !isSearching && searchResults.length === 0 && (
                  <p className="text-center text-gray-500">No users found.</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter Section */}
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-3 text-sm font-medium rounded-md"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-3 text-sm font-medium rounded-md relative"
            onClick={() => setFilter('unread')}
          >
            Unread
            {chats.some(chat => chat.unreadCount > 0) && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {chats.reduce((sum, chat) => sum + chat.unreadCount, 0)}
              </span>
            )}
          </Button>
        </div>

        {/* Search Input for existing chats */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search chats..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">
              {filter === 'unread' ? 'No unread messages' : 'No conversations yet'}
            </h3>
            <p className="text-sm mb-4">
              {filter === 'unread' ? 'All messages have been read' : 'Start a new conversation to begin messaging'}
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
                  {/* FORCE NAME DISPLAY - OUTSIDE ALL CSS */}
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '100px',
                    backgroundColor: '#ff0000',
                    color: '#ffffff',
                    padding: '10px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    zIndex: 9999,
                    border: '3px solid #00ff00'
                  }}>
                    {chat.recipientName || chat.recipientId || 'Unknown User'}
                  </div>
                  
                  {/* Name Row */}
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate flex-1 min-w-0 bg-red-500 text-white p-2">
                      {(() => {
                        const name = chat.recipientName || chat.recipientId || 'Unknown User';
                        console.log('🎯 JSX rendering name:', name, 'for chat:', chat.id);
                        return name;
                      })()}
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
                        <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[16px] text-center font-medium">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 truncate">
                    {chat.lastMessage && chat.lastMessage !== 'No messages yet' 
                      ? chat.lastMessage 
                      : 'No messages yet'
                    }
                  </p>
                </div>

                {/* Delete Button */}
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                  onClick={(e) => handleDeleteClick(chat.id, chat.recipientName, e)}
                  disabled={deletingChatId === chat.id}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!chatToDelete} onOpenChange={(open) => !open && setChatToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500">
              Are you sure you want to delete your chat with {chatToDelete?.name}? This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              className="bg-white hover:bg-gray-50 border-gray-200"
              onClick={() => setChatToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deletingChatId === chatToDelete?.id}
            >
              {deletingChatId === chatToDelete?.id ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}