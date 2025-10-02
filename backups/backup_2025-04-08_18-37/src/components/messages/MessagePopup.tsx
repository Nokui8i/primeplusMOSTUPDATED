'use client';

import { useState, ChangeEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Minus, Search, Mic, Image as ImageIcon, Smile, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { messagesService } from '@/lib/services/messages';
import { User } from '@/lib/types/user';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

interface MessagePopupProps {
  onClose: () => void;
}

export function MessagePopup({ onClose }: MessagePopupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const db = getFirestore();

  useEffect(() => {
    const fetchFollowedUsers = async () => {
      if (!currentUser) return;
      
      try {
        // Get users that the current user follows
        const followsRef = collection(db, 'follows');
        const q = query(followsRef, where('followerId', '==', currentUser.uid));
        const followsSnapshot = await getDocs(q);
        
        const followedUserIds = followsSnapshot.docs.map(doc => doc.data().followedId);
        
        // Get user details for followed users
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(query(usersRef, where('uid', 'in', followedUserIds)));
        
        const fetchedUsers = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          displayName: doc.data().displayName,
          photoURL: doc.data().photoURL,
          isPrivate: doc.data().isPrivate
        }));
        
        setUsers(fetchedUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast({
          title: 'Error loading users',
          description: 'Please try again later',
          variant: 'destructive',
        });
      }
    };

    fetchFollowedUsers();
  }, [currentUser, toast]);

  const filteredUsers = users.filter(user =>
    user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments([...attachments, ...files]);
  };

  const handleSendMessage = async () => {
    if (!selectedUser || !message.trim()) return;
    
    setSending(true);
    try {
      // Get or create thread
      const threadId = await messagesService.getOrCreateThread([currentUser!.uid, selectedUser.id]);
      
      // Send message
      await messagesService.sendMessage(
        threadId,
        currentUser!.uid,
        selectedUser.id,
        message.trim(),
        'text',
        attachments
      );
      
      // Navigate to the messages page with the thread selected
      router.push(`/messages?thread=${threadId}`);
      onClose();
      
      toast({
        title: 'Message sent',
        description: 'Your message has been sent successfully',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error sending message',
        description: 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-0 right-4 w-80 bg-white rounded-t-lg shadow-lg border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-white text-gray-800 rounded-t-lg">
        <h3 className="font-semibold">New message</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-gray-600 hover:text-gray-800 hover:bg-gray-100"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-gray-600 hover:text-gray-800 hover:bg-gray-100"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="flex flex-col h-96">
          {!selectedUser ? (
            <>
              <div className="p-3 border-b border-gray-200 flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-400" />
                <Input
                  placeholder="To:"
                  value={searchQuery}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="border-0 focus-visible:ring-0 px-0 bg-transparent text-gray-800"
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left text-gray-800"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 relative overflow-hidden">
                      {user.photoURL ? (
                        <Image
                          src={user.photoURL}
                          alt={user.displayName}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                          {user.displayName.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{user.displayName}</p>
                      {user.isPrivate && (
                        <p className="text-sm text-gray-500">Secret conversation</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Selected User Header */}
              <div className="p-3 border-b border-gray-200 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 relative overflow-hidden">
                  {selectedUser.photoURL ? (
                    <Image
                      src={selectedUser.photoURL}
                      alt={selectedUser.displayName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      {selectedUser.displayName.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{selectedUser.displayName}</h4>
                  <p className="text-sm text-gray-500">End-to-end encrypted</p>
                </div>
              </div>

              {/* Message Input Area */}
              <div className="flex-1 p-4 space-y-4">
                {/* Attachments Preview */}
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <span className="text-sm truncate">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Input */}
                <div className="flex flex-col gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        multiple
                        onChange={handleFileSelect}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-500 hover:text-gray-700"
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        <ImageIcon className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <Smile className="h-5 w-5" />
                      </Button>
                    </div>
                    
                    <Button
                      onClick={handleSendMessage}
                      disabled={!message.trim() || sending}
                      className="bg-[#E91E63] hover:bg-[#D81B60] text-white"
                    >
                      {sending ? (
                        <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
} 