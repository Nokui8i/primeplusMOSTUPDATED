import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, where, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Trash2 } from 'lucide-react';
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
}

interface ChatListProps {
  onSelectChat: (recipientId: string, recipientName: string) => void;
}

export function ChatList({ onSelectChat }: ChatListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<ChatMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchChats = async () => {
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', user.uid)
      );

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        // Get the current chat IDs to check for deletions
        const currentChatIds = new Set(chats.map(chat => chat.id));
        
        const chatPromises = snapshot.docs.map(async (chatDoc) => {
          // Skip if this chat was just deleted
          if (deletingChatId === chatDoc.id) {
            return null;
          }

          const chatData = chatDoc.data();
          const recipientId = chatData.participants.find((id: string) => id !== user.uid);
          
          // Ensure we have a valid recipientId
          if (!recipientId) {
            console.warn('No recipientId found for chat:', chatDoc.id);
            return null;
          }

          const recipientRef = collection(db, 'users');
          const recipientQuery = query(recipientRef, where('uid', '==', recipientId));
          const recipientSnapshot = await getDocs(recipientQuery);
          let userData: any = recipientSnapshot.docs[0]?.data() || null;
          
          // If no user data found, try to get it directly by ID
          if (!userData) {
            const directUserRef = doc(db, 'users', recipientId);
            const directUserDoc = await getDoc(directUserRef);
            userData = directUserDoc.exists() ? directUserDoc.data() : null;
          }

          // If still no user data, try username lookup
          if (!userData) {
            const usernameQuery = query(recipientRef, where('username', '==', recipientId));
            const usernameSnapshot = await getDocs(usernameQuery);
            userData = usernameSnapshot.docs[0]?.data() || null;
          }

          // Debug log for userData and recipientId
          console.log('ChatList recipientId:', recipientId, 'userData:', userData);

          // Get the best available name
          const recipientName = userData?.displayName || userData?.username || recipientId;
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
        
        // Sort chats in memory by lastMessageTime or createdAt
        const sortedChats = chatResults.sort((a, b) => {
          const timeA = a.lastMessageTime?.toDate?.() || new Date(0);
          const timeB = b.lastMessageTime?.toDate?.() || new Date(0);
          return timeB.getTime() - timeA.getTime();
        });
        
        // Deduplicate chats by recipientId, keeping the latest one
        const dedupedChatsMap = new Map<string, ChatMetadata>();
        for (const chat of sortedChats) {
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
        setChats(Array.from(dedupedChatsMap.values()));
      });

      return () => unsubscribe();
    };

    fetchChats();
  }, [user, deletingChatId]);

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
          photoURL: data.photoURL
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
    <div className="w-full md:w-56 h-full overflow-y-auto bg-white/30 backdrop-blur-lg p-1 md:p-2 space-y-2 md:space-y-3">
      <div className="mb-2 md:mb-4">
        <h2 className="text-base md:text-lg font-semibold text-[#3B3B4F] drop-shadow-[0_0_8px_rgba(107,59,191,0.08)]">Chats</h2>
      </div>
      {chats.map((chat) => (
        <div
          key={chat.id}
          className="group flex items-center gap-2 md:gap-3 p-2 bg-white/60 hover:bg-[#6B3BFF]/10 hover:border-[#6B3BFF] hover:shadow-blue-100 border border-transparent rounded-lg cursor-pointer transition-colors relative"
          onClick={() => onSelectChat(chat.recipientId, chat.recipientName)}
        >
          <Avatar className="h-8 w-8 md:h-10 md:w-10">
            {chat.recipientPhotoURL ? (
              <AvatarImage src={chat.recipientPhotoURL} />
            ) : (
              <AvatarImage src='/default-avatar.png' />
            )}
            <AvatarFallback className="text-[#6B3BFF] bg-white/30">{chat.recipientName[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-medium truncate text-[#3B3B4F] text-xs md:text-sm">{chat.recipientName}</p>
              <div className="flex items-center gap-2">
                {chat.unreadCount > 0 && (
                  <span className="bg-white border border-[#6B3BFF] text-[#6B3BFF] shadow-blue-100 text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full shadow-md">
                    {chat.unreadCount}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={(e) => handleDeleteClick(chat.id, chat.recipientName, e)}
                  disabled={deletingChatId === chat.id}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {chat.lastMessage && chat.lastMessage !== 'No messages yet' && (
              <p className="text-xs md:text-sm text-[#1A1A1A] truncate">{chat.lastMessage}</p>
            )}
          </div>
        </div>
      ))}

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