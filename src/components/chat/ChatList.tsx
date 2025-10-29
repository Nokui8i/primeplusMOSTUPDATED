import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, where, doc, setDoc, getDoc, deleteDoc, serverTimestamp, updateDoc, writeBatch, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { MessagesAvatar } from '@/components/ui/MessagesAvatar';
import { Button } from '@/components/ui/button';
import { X, MessageCircle, Pin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { deleteFromS3, extractS3KeyFromUrl } from '@/lib/aws/s3';

interface ChatMetadata {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientUsername?: string;
  recipientPhotoURL?: string | null;
  lastMessage: string;
  lastMessageTime: any;
  unreadCount: number;
  pinned?: boolean;
  sharedChatId?: string; // Reference to the shared chat for messages
}


interface ChatListProps {
  onSelectChat: (recipientId: string, recipientName: string, sharedChatId?: string) => void;
  onChatDeleted?: (recipientId: string) => void; // Callback when a chat is deleted
  searchQuery?: string;
  filterType?: 'all' | 'unread' | 'pinned';
}

export function ChatList({ onSelectChat, onChatDeleted, searchQuery = '', filterType = 'all' }: ChatListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<ChatMetadata[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatMetadata[]>([]);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<{ id: string; name: string; recipientId: string; sharedChatId?: string } | null>(null);
  const [deletedChatIds, setDeletedChatIds] = useState<Set<string>>(new Set()); // Track deleted chat IDs to prevent them from reappearing
  const deletedChatIdsRef = React.useRef<Set<string>>(new Set()); // Use ref to access current value in onSnapshot callback

  // Sync ref with state
  useEffect(() => {
    deletedChatIdsRef.current = deletedChatIds;
  }, [deletedChatIds]);

  useEffect(() => {
    if (!user || !user.uid) return;

    const fetchChats = async () => {
      // Query user's personal chat list instead of shared chats
      const userChatsRef = collection(db, 'users', user.uid, 'chats');
      const q = query(
        userChatsRef,
        orderBy('lastMessageTime', 'desc')
      );

      const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, async (snapshot) => {
        // CRITICAL: Track removals immediately
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'removed') {
            // Document was removed - add to deleted set immediately
            setDeletedChatIds(prev => {
              const next = new Set(prev);
              next.add(change.doc.id);
              return next;
            });
            // Update ref immediately
            deletedChatIdsRef.current = new Set([...deletedChatIdsRef.current, change.doc.id]);
          }
        });
        
        // CRITICAL: Filter out deleted chats IMMEDIATELY - before any processing
        // This is the key for mobile - we must filter before the async operations
        const activeChatDocs = snapshot.docs.filter(doc => {
          // FIRST: Always check deletedChatIdsRef first (most reliable, instant)
          if (deletedChatIdsRef.current.has(doc.id)) {
            return false; // Skip this chat - it was deleted
          }
          
          // SECOND: Check deletedByUser flag
          const data = doc.data();
          if (!doc.exists() || data.deletedByUser) {
            return false;
          }
          
          return true;
        });
        
        const chatPromises = activeChatDocs.map(async (chatDoc) => {
          const data = chatDoc.data();
          
          const otherUserId = data.otherUserId;
          if (!otherUserId) return null;

          // Get user info (use data from snapshot - no need for extra getDoc)
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          const userData = userDoc.exists() ? userDoc.data() : {};
          
          // Use data directly from snapshot (already up-to-date)
          const updatedData = data;
          
          // Get last message from the shared messages collection
          let lastMessage = updatedData.lastMessage || '';
          let finalLastMessageTime = updatedData.lastMessageTime;
          const currentSharedChatId = updatedData.sharedChatId;
          
          // Verify lastMessage if we have it, or fetch if missing
          // This ensures deleted messages don't show in chat preview
          if (currentSharedChatId) {
            // Quick check: if lastMessage exists, verify it's still valid
            // If missing or empty, fetch from messages
            const shouldVerify = lastMessage || !updatedData.lastMessage; // Verify if we have one or if it's explicitly missing
            
            if (shouldVerify) {
              // Fetch last messages and find first non-deleted one
              try {
                const messagesRef = collection(db, 'chats', currentSharedChatId, 'messages');
                // Get multiple messages to find the first non-deleted one
                const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(10));
                const messagesSnapshot = await getDocs(messagesQuery);
                
                // Find the first non-deleted message
                let lastNonDeletedMsg: any = null;
                for (const msgDoc of messagesSnapshot.docs) {
                  const msgData = msgDoc.data();
                  if (!msgData.deleted) {
                    lastNonDeletedMsg = msgData;
                    break;
                  }
                }
                
                if (lastNonDeletedMsg) {
                  const newLastMessage = lastNonDeletedMsg.text || 
                    (lastNonDeletedMsg.imageUrl ? '📷 Image' : 
                     lastNonDeletedMsg.videoUrl ? '🎥 Video' : 
                     lastNonDeletedMsg.audioUrl ? '🎵 Voice message' : '');
                  
                  // Only update if different (avoid unnecessary writes)
                  if (newLastMessage !== lastMessage) {
                    lastMessage = newLastMessage;
                    finalLastMessageTime = lastNonDeletedMsg.timestamp;
                    
                    // Update metadata in background (don't block UI)
                    updateDoc(chatDoc.ref, {
                      lastMessage: lastMessage,
                      lastMessageTime: finalLastMessageTime
                    }).catch(err => console.warn('Failed to update chat metadata:', err));
                  }
                } else if (lastMessage) {
                  // Had a message before but now all are deleted - clear it
                  lastMessage = '';
                  finalLastMessageTime = null;
                  
                  // Update metadata in background
                  updateDoc(chatDoc.ref, {
                    lastMessage: '',
                    lastMessageTime: null
                  }).catch(err => console.warn('Failed to update chat metadata:', err));
                }
              } catch (error) {
                console.error('Error fetching last message:', error);
              }
            }
          }
          
          const unreadCount = updatedData.unreadCount || 0;
          
          return {
            id: chatDoc.id,
            recipientId: otherUserId,
            recipientName: userData.displayName || userData.username || 'Unknown User',
            recipientUsername: userData.username,
            recipientPhotoURL: userData.photoURL,
            lastMessage: lastMessage,
            lastMessageTime: finalLastMessageTime,
            unreadCount: unreadCount,
            pinned: updatedData.pinned || false,
            sharedChatId: currentSharedChatId // Keep reference to shared chat
          };
        });

        const chatResults = await Promise.all(chatPromises);
        const validChats = chatResults.filter(chat => chat !== null) as ChatMetadata[];
        
        // FINAL FILTER: One more check before setting state (critical for mobile)
        // This prevents any deleted chats from slipping through
        const finalChats = validChats.filter(chat => {
          // Double-check deletedChatIdsRef (should never pass if filtering worked correctly)
          return !deletedChatIdsRef.current.has(chat.id);
        });
        
        // Sort chats: pinned first, then by lastMessageTime
        const sortedChats = finalChats.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          if (a.lastMessageTime && b.lastMessageTime) {
            return b.lastMessageTime.toMillis() - a.lastMessageTime.toMillis();
          }
          return 0;
        });
        
        setChats(sortedChats);
      });

      return () => unsubscribe();
    };

    fetchChats();
  }, [user]); // Removed deletingChatId dependency - deletedChatIds ref handles it

  // Filter chats based on search query and filter type
  useEffect(() => {
    let filtered = chats;

    // Apply filter type
    if (filterType === 'unread') {
      filtered = filtered.filter(chat => chat.unreadCount > 0);
    }
    
    if (filterType === 'pinned') {
      filtered = filtered.filter(chat => chat.pinned);
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
    if (!chatToDelete || !user) return;

    setDeletingChatId(chatToDelete.id);
    
    // CRITICAL: Add to deleted set FIRST (before optimistic update)
    // This ensures onSnapshot won't add it back even with cached data
    const newDeletedSet = new Set([...deletedChatIds, chatToDelete.id]);
    setDeletedChatIds(newDeletedSet);
    deletedChatIdsRef.current = newDeletedSet; // Update ref immediately
    
    // Optimistically remove from UI immediately
    setChats(prevChats => prevChats.filter(chat => chat.id !== chatToDelete.id));
    
    try {
      const userChatRef = doc(db, 'users', user.uid, 'chats', chatToDelete.id);
      const userChatDoc = await getDoc(userChatRef);
      
      // Get the sharedChatId (from chatToDelete or from the document)
      const sharedChatId = chatToDelete.sharedChatId || userChatDoc.data()?.sharedChatId;
      
      // CRITICAL: Check if the other user also deleted their chat BEFORE deleting our chat
      // This way we know for sure if both deleted
      const recipientChatId = `${chatToDelete.recipientId}_${user.uid}`;
      const recipientChatRef = doc(db, 'users', chatToDelete.recipientId, 'chats', recipientChatId);
      const recipientChatDoc = await getDoc(recipientChatRef);
      
      // Check if the other user's chat exists
      // If it exists, they haven't deleted it yet - DON'T delete everything
      const otherUserChatExists = recipientChatDoc.exists();
      const otherUserAlreadyDeleted = !otherUserChatExists;
      
      console.log('🔍 [ChatList] Delete check:', {
        currentUserId: user.uid,
        recipientId: chatToDelete.recipientId,
        recipientChatId: recipientChatId,
        otherUserChatExists: otherUserChatExists,
        otherUserAlreadyDeleted: otherUserAlreadyDeleted,
        shouldDeleteAll: otherUserAlreadyDeleted
      });
      
      // Delete the personal chat entry completely (not just mark as deleted)
      await deleteDoc(userChatRef);
      console.log('🗑️ [ChatList] Deleted current user\'s personal chat entry:', chatToDelete.id);
      
      // CRITICAL: Only delete everything if BOTH users deleted (or already deleted)
      // Logic: 
      // - If otherUserChatExists === true: Second user still has chat → DON'T delete files/media (they can still see)
      // - If otherUserChatExists === false: Second user already deleted → DELETE everything (both deleted)
      // This matches Firebase Storage cleanup behavior - only delete when BOTH users deleted
      const bothUsersDeleted = otherUserAlreadyDeleted;
      
      if (!bothUsersDeleted) {
        console.log('🔍 [ChatList] Other user still has chat - NOT deleting shared data (images/videos/messages will remain)');
        // Show success immediately - cleanup is not needed
        // Media files will remain in AWS S3 because the other user can still access the conversation
        toast({
          title: "Chat deleted",
          description: "The chat has been removed from your list. The other user can still see the conversation.",
        });
        
        // Close the chat if it's currently open
        if (onChatDeleted && chatToDelete.recipientId) {
          onChatDeleted(chatToDelete.recipientId);
        }
        return; // Exit early - no cleanup needed, media files stay in S3
      }
      
      // Only reach here if BOTH users deleted (otherUserAlreadyDeleted === true)
      console.log('🗑️ [ChatList] BOTH users deleted the chat - will delete all messages and media files from AWS S3');
      
      // Both users deleted - show success immediately, do cleanup in background
      toast({
        title: "Chat deleted",
        description: "Cleaning up messages and media files...",
      });
      
      // Close the chat if it's currently open (don't wait for cleanup)
      if (onChatDeleted && chatToDelete.recipientId) {
        onChatDeleted(chatToDelete.recipientId);
      }
      
      // Do the heavy cleanup in background (async, don't block UI)
      if (sharedChatId) {
        // Both users deleted - delete everything: messages, media files, and shared chat document
        // Run in background for better performance
            (async () => {
              try {
            console.log('🗑️ Both users deleted the chat - cleaning up everything:', sharedChatId);
          // Find ALL possible sharedChatIds for this conversation (might have multiple if users deleted before)
          // Base sharedChatId: sorted user IDs
          const baseSharedChatId = [user.uid, chatToDelete.recipientId].sort().join('_');
          
          // Start with the known sharedChatId
          const sharedChatIdsToDelete: string[] = [sharedChatId];
          
          // If sharedChatId has a timestamp, we should also check the base version
          // (in case the other user still uses the base sharedChatId)
          const hasTimestamp = sharedChatId.includes('_') && /_\d{13}$/.test(sharedChatId);
          
          if (hasTimestamp || sharedChatId !== baseSharedChatId) {
            // Check if base sharedChatId exists (for cases where users have different versions)
            try {
              const baseChatRef = doc(db, 'chats', baseSharedChatId);
              const baseChatDoc = await getDoc(baseChatRef);
              if (baseChatDoc.exists() && !sharedChatIdsToDelete.includes(baseSharedChatId)) {
                sharedChatIdsToDelete.push(baseSharedChatId);
              }
            } catch (err) {
              console.warn('Failed to check base sharedChatId:', err);
            }
          }
          
          console.log('🗑️ [ChatList] Found sharedChatIds to delete:', sharedChatIdsToDelete);
          console.log('🗑️ [ChatList] Starting cleanup: Both users deleted → deleting messages and ALL media files from AWS S3');
          
          // Delete messages and media from ALL shared chat IDs
          // This only runs when BOTH users deleted (same logic as Firebase Storage cleanup)
          const allDeleteMediaPromises: Promise<void>[] = [];
          const allMessageBatches: any[] = [];
          let totalMediaFiles = 0;
          let totalMessages = 0;
          
          for (const chatIdToDelete of sharedChatIdsToDelete) {
            // Get all messages from this shared chat
            const messagesRef = collection(db, 'chats', chatIdToDelete, 'messages');
            const messagesSnapshot = await getDocs(messagesRef);
            
            if (messagesSnapshot.empty) {
              console.log(`🗑️ [ChatList] No messages found in shared chat: ${chatIdToDelete}`);
              continue;
            }
            
            totalMessages += messagesSnapshot.size;
            console.log(`🗑️ [ChatList] Found ${messagesSnapshot.size} messages in shared chat: ${chatIdToDelete}`);
          
            // Collect media files to delete
            messagesSnapshot.docs.forEach((messageDoc) => {
              const messageData = messageDoc.data();
              
              // Delete image
              if (messageData.imageUrl) {
                try {
                  const s3Key = extractS3KeyFromUrl(messageData.imageUrl);
                  console.log(`🗑️ [ChatList] Queuing image deletion from S3: ${s3Key}`);
                  totalMediaFiles++;
                  allDeleteMediaPromises.push(
                    deleteFromS3(s3Key).then(() => {
                      console.log(`✅ [ChatList] Successfully deleted image from S3: ${s3Key}`);
                    }).catch(err => {
                      console.error('❌ [ChatList] Failed to delete image from S3:', s3Key, err);
                    })
                  );
                } catch (err) {
                  console.warn('⚠️ [ChatList] Failed to extract S3 key from imageUrl:', messageData.imageUrl, err);
                }
              }
              
              // Delete video
              if (messageData.videoUrl) {
                try {
                  const s3Key = extractS3KeyFromUrl(messageData.videoUrl);
                  console.log(`🗑️ [ChatList] Queuing video deletion from S3: ${s3Key}`);
                  totalMediaFiles++;
                  allDeleteMediaPromises.push(
                    deleteFromS3(s3Key).then(() => {
                      console.log(`✅ [ChatList] Successfully deleted video from S3: ${s3Key}`);
                    }).catch(err => {
                      console.error('❌ [ChatList] Failed to delete video from S3:', s3Key, err);
                    })
                  );
                } catch (err) {
                  console.warn('⚠️ [ChatList] Failed to extract S3 key from videoUrl:', messageData.videoUrl, err);
                }
              }
              
              // Delete audio
              if (messageData.audioUrl) {
                try {
                  const s3Key = extractS3KeyFromUrl(messageData.audioUrl);
                  console.log(`🗑️ [ChatList] Queuing audio deletion from S3: ${s3Key}`);
                  totalMediaFiles++;
                  allDeleteMediaPromises.push(
                    deleteFromS3(s3Key).then(() => {
                      console.log(`✅ [ChatList] Successfully deleted audio from S3: ${s3Key}`);
                    }).catch(err => {
                      console.error('❌ [ChatList] Failed to delete audio from S3:', s3Key, err);
                    })
                  );
              } catch (err) {
                  console.warn('⚠️ [ChatList] Failed to extract S3 key from audioUrl:', messageData.audioUrl, err);
                }
              }
              
              // Delete attachments
              if (messageData.attachments && Array.isArray(messageData.attachments)) {
                messageData.attachments.forEach((attachment: any) => {
                  if (attachment.url) {
                    try {
                      const s3Key = extractS3KeyFromUrl(attachment.url);
                      console.log(`🗑️ [ChatList] Queuing attachment deletion from S3: ${s3Key}`);
                      totalMediaFiles++;
                      allDeleteMediaPromises.push(
                        deleteFromS3(s3Key).then(() => {
                          console.log(`✅ [ChatList] Successfully deleted attachment from S3: ${s3Key}`);
                        }).catch(err => {
                          console.error('❌ [ChatList] Failed to delete attachment from S3:', s3Key, err);
                        })
                      );
                    } catch (err) {
                      console.warn('⚠️ [ChatList] Failed to extract S3 key from attachment:', attachment.url, err);
                    }
                  }
                });
              }
            });
            
            // Prepare batch delete for messages
            const batch = writeBatch(db);
            messagesSnapshot.docs.forEach((messageDoc) => {
              batch.delete(messageDoc.ref);
            });
            allMessageBatches.push(batch);
          }
          
          console.log(`🗑️ [ChatList] Total media files to delete: ${totalMediaFiles}, Total messages: ${totalMessages}`);
          
          // Delete media files in parallel (don't block on failures)
          if (allDeleteMediaPromises.length > 0) {
            console.log(`🗑️ [ChatList] Starting deletion of ${allDeleteMediaPromises.length} media files from S3...`);
            const mediaDeletion = Promise.allSettled(allDeleteMediaPromises).then((results) => {
              const succeeded = results.filter(r => r.status === 'fulfilled').length;
              const failed = results.filter(r => r.status === 'rejected').length;
              console.log(`✅ [ChatList] Media deletion complete: ${succeeded} succeeded, ${failed} failed`);
              if (failed > 0) {
                console.error('❌ [ChatList] Failed deletions:', results.filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason));
              }
            });
            
            // Commit all message batch deletions in parallel
            if (allMessageBatches.length > 0) {
              console.log(`🗑️ [ChatList] Starting deletion of ${totalMessages} messages from Firestore...`);
              const messageDeletion = Promise.all(allMessageBatches.map(batch => batch.commit())).then(() => {
                console.log(`✅ [ChatList] Successfully deleted all ${totalMessages} messages from Firestore`);
              }).catch(err => {
                console.error('❌ [ChatList] Failed to delete some message batches:', err);
              });
              
              // Wait for both operations to complete
              await Promise.all([mediaDeletion, messageDeletion]);
            } else {
              await mediaDeletion;
            }
          } else if (allMessageBatches.length > 0) {
            // Only messages, no media
            console.log(`🗑️ [ChatList] No media files found, deleting ${totalMessages} messages only...`);
            await Promise.all(allMessageBatches.map(batch => batch.commit()));
            console.log(`✅ [ChatList] Successfully deleted all ${totalMessages} messages from Firestore`);
          } else {
            console.log(`⚠️ [ChatList] No messages or media files found to delete`);
          }
          
          // Delete all shared chat documents in parallel
          await Promise.all(
            sharedChatIdsToDelete.map(async (chatIdToDelete) => {
              const sharedChatRef = doc(db, 'chats', chatIdToDelete);
              await deleteDoc(sharedChatRef);
              console.log(`✅ Deleted shared chat document: ${chatIdToDelete}`);
            })
          );

      toast({
              title: "Chat completely deleted",
              description: "All messages, media files, and chat data have been permanently deleted.",
            });
          } catch (cleanupError) {
            console.error('Error cleaning up deleted chat:', cleanupError);
            // Show error but don't block - the personal chat is already deleted
            toast({
              title: "Cleanup in progress",
              description: "Chat deleted. Some cleanup operations are still running in the background.",
              variant: "default",
            });
          }
        })(); // Execute async cleanup immediately but don't await
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      // Revert optimistic update on error
      setDeletedChatIds(prev => {
        const next = new Set(prev);
        next.delete(chatToDelete.id);
        return next;
      });
      // The onSnapshot will restore it if deletion failed
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
      <div className="flex-1 overflow-y-auto pb-14 md:pb-0" style={{ minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
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
          <div>
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                className="group flex items-center gap-3 p-3 hover:bg-blue-50/50 cursor-pointer transition-colors relative"
                onClick={() => onSelectChat(chat.recipientId, chat.recipientName, chat.sharedChatId)}
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
                  {/* Name and Username Row - Inline */}
                  <div className="flex items-center gap-2 mb-1">
                    {chat.pinned && (
                      <Pin className="w-3 h-3 text-blue-600 fill-blue-600 flex-shrink-0" />
                    )}
                    <h3 className="text-base font-semibold text-gray-900">
                      {chat.recipientName || chat.recipientId || 'Unknown User'}
                    </h3>
                    {chat.recipientUsername && (
                      <span className="text-sm text-gray-500">
                        @{chat.recipientUsername}
                      </span>
                    )}
                    {chat.unreadCount > 0 && (
                      <div className="w-3.5 h-3.5 rounded-full shadow-lg flex-shrink-0" style={{
                        background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
                        boxShadow: '0 2px 8px rgba(96, 165, 250, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }} />
                    )}
                  </div>
                  
                  {/* Message Row */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 truncate flex-1 min-w-0">
                      {chat.lastMessage || 'No messages yet'}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatToDelete({ id: chat.id, name: chat.recipientName, recipientId: chat.recipientId, sharedChatId: chat.sharedChatId });
                      }}
                      className="ml-2 flex-shrink-0 transition-all"
                      style={{ padding: '2px', marginTop: '-12px' }}
                      disabled={deletingChatId === chat.id}
                    >
                      <X className="h-3.5 w-3.5" style={{ color: '#6b7280' }} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
                
                {/* Bottom separator line */}
                <div className="absolute bottom-0 left-0 right-0 h-p x bg-gray-200"></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!chatToDelete} onOpenChange={() => setChatToDelete(null)}>
        <DialogContent 
          className="sm:max-w-[320px] rounded-xl border-0 p-0 overflow-hidden"
          style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            boxShadow: `
              0 4px 20px rgba(0, 0, 0, 0.1),
              0 2px 8px rgba(0, 0, 0, 0.08),
              inset 0 1px 0 rgba(255, 255, 255, 0.9),
              inset 0 -1px 0 rgba(0, 0, 0, 0.05)
            `,
          }}
        >
          <DialogHeader className="space-y-2 px-4 pt-3 pb-2 border-b border-gray-100">
            <DialogTitle className="text-lg font-semibold text-gray-800">
              Delete Chat
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 leading-relaxed pb-1">
              Remove the chat with <span className="font-medium text-gray-700">{chatToDelete?.name}</span> from your list?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-3 px-4 py-4 sm:flex-row sm:gap-2 sm:py-3 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setChatToDelete(null)}
                disabled={deletingChatId === chatToDelete?.id}
              className="!rounded-xl !w-auto !px-6 !py-3 !text-sm !font-medium !transition-all !duration-200 !border !border-gray-300 !bg-white !text-gray-700 hover:!bg-gray-50 hover:!border-gray-400 active:!bg-gray-100 sm:!h-7 sm:!min-h-7 sm:!max-h-7 sm:!px-3 sm:!py-1.5 sm:!text-xs sm:!rounded-lg"
              style={{
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                minHeight: '48px',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget) {
                  e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget) {
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
              onMouseDown={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget) {
                  e.currentTarget.style.transform = 'translateY(0px)';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
                }
              }}
              onMouseUp={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                }
              }}
              onTouchStart={(e) => {
                if (e.currentTarget) {
                  e.currentTarget.style.opacity = '0.8';
                }
              }}
              onTouchEnd={(e) => {
                const target = e.currentTarget;
                if (target) {
                  setTimeout(() => {
                    if (target) {
                      target.style.opacity = '1';
                    }
                  }, 150);
                }
              }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteChat}
                disabled={deletingChatId === chatToDelete?.id}
              className="!rounded-xl !w-auto !px-6 !py-3 !text-sm !font-semibold !transition-all !duration-200 !border !border-gray-300 !bg-white !text-gray-900 hover:!bg-gray-50 hover:!border-gray-400 active:!bg-gray-100 active:!opacity-90 sm:!h-7 sm:!min-h-7 sm:!max-h-7 sm:!px-3 sm:!py-1.5 sm:!text-xs sm:!font-medium sm:!rounded-lg"
              style={{
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                minHeight: '48px',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget) {
                  e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget) {
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
              onMouseDown={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget) {
                  e.currentTarget.style.transform = 'translateY(0px) scale(0.98)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2), inset 0 1px 2px rgba(0, 0, 0, 0.15)';
                }
              }}
              onMouseUp={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                }
              }}
              onTouchStart={(e) => {
                if (e.currentTarget) {
                  e.currentTarget.style.opacity = '0.85';
                  e.currentTarget.style.transform = 'scale(0.98)';
                }
              }}
              onTouchEnd={(e) => {
                const target = e.currentTarget;
                if (target) {
                  setTimeout(() => {
                    if (target) {
                      target.style.opacity = '1';
                      target.style.transform = 'scale(1)';
                    }
                  }, 150);
                }
              }}
            >
              {deletingChatId === chatToDelete?.id ? (
                <span className="flex items-center gap-1">
                  <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-gray-900 border-t-transparent rounded-full"></span>
                  Removing...
                </span>
              ) : (
                'Remove'
              )}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}