import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDoc,
  onSnapshot,
  Timestamp,
  startAfter,
  increment,
  arrayUnion,
  arrayRemove,
  Query,
  DocumentData
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Message, Thread, MessageType, MessageStatus, MessageAttachment, ReactionType, UserPresence } from '../types/messages';
import { v4 as uuidv4 } from 'uuid';

const MESSAGES_PER_PAGE = 20;
const TYPING_TIMEOUT = 5000; // 5 seconds

export class MessageService {
  constructor() {
    // Initialize any necessary dependencies
  }

  async getOrCreateThread(participantIds: string[]): Promise<string> {
    const sortedParticipants = [...participantIds].sort();
    const threadsRef = collection(db, 'threads');
    const q = query(
      threadsRef,
      where('participants', '==', sortedParticipants)
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }

    const newThread = await addDoc(threadsRef, {
      participants: sortedParticipants,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      unreadCount: participantIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {})
    });

    return newThread.id;
  }

  async sendMessage(
    threadId: string,
    senderId: string,
    receiverId: string,
    content: string,
    type: MessageType = 'text',
    attachments?: File[],
    forwardedFrom?: string
  ): Promise<string> {
    try {
      // Upload attachments if any
      let messageAttachments: MessageAttachment[] = [];
      if (attachments && attachments.length > 0) {
        messageAttachments = await Promise.all(
          attachments.map(async (file) => {
            const storageRef = ref(storage, `messages/${threadId}/${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            return {
              url,
              type: file.type,
              name: file.name,
              size: file.size
            };
          })
        );
      }

      // Create message
      const message: Partial<Message> = {
        threadId,
        senderId,
        receiverId,
        content,
        type,
        status: 'sent',
        timestamp: Timestamp.now(),
        attachments: messageAttachments,
        seenBy: [senderId],
        forwardedFrom
      };

      // Add message to Firestore
      const messagesRef = collection(db, 'messages');
      const docRef = await addDoc(messagesRef, message);

      // Update thread
      const threadRef = doc(db, 'threads', threadId);
      await updateDoc(threadRef, {
        lastMessage: {
          content,
          senderId,
          timestamp: message.timestamp,
          type
        },
        updatedAt: message.timestamp,
        [`unreadCount.${receiverId}`]: increment(1)
      });

      return docRef.id;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async getMessages(threadId: string, lastMessageTimestamp?: Timestamp) {
    const messagesRef = collection(db, 'messages');
    let q = query(
      messagesRef,
      where('threadId', '==', threadId),
      orderBy('timestamp', 'desc'),
      limit(MESSAGES_PER_PAGE)
    );

    if (lastMessageTimestamp) {
      q = query(q, startAfter(lastMessageTimestamp));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Message));
  }

  subscribeToMessages(threadId: string, callback: (messages: Message[]) => void) {
    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('threadId', '==', threadId),
      orderBy('timestamp', 'desc'),
      limit(MESSAGES_PER_PAGE)
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      callback(messages);
    });
  }

  async markMessagesAsRead(threadId: string, userId: string) {
    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('threadId', '==', threadId),
      where('receiverId', '==', userId),
      where('status', '!=', 'read')
    );

    const snapshot = await getDocs(q);
    const updatePromises = snapshot.docs.map(doc =>
      updateDoc(doc.ref, { status: 'read' })
    );

    await Promise.all(updatePromises);

    // Reset unread count for this user in the thread
    const threadRef = doc(db, 'threads', threadId);
    await updateDoc(threadRef, {
      [`unreadCount.${userId}`]: 0
    });
  }

  async deleteMessage(messageId: string) {
    const messageRef = doc(db, 'messages', messageId);
    await updateDoc(messageRef, {
      isDeleted: true,
      content: 'This message was deleted'
    });
  }

  async editMessage(messageId: string, newContent: string): Promise<void> {
    const messageRef = doc(db, 'messages', messageId);
    await updateDoc(messageRef, {
      content: newContent,
      editedAt: serverTimestamp(),
      isEdited: true
    });
  }

  async getUserThreads(userId: string) {
    const threadsRef = collection(db, 'threads');
    const q = query(
      threadsRef,
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Thread));
  }

  subscribeToUserThreads(userId: string, callback: (threads: Thread[]) => void) {
    const threadsRef = collection(db, 'threads');
    const q = query(
      threadsRef,
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const threads = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Thread));
      callback(threads);
    });
  }

  async setTypingStatus(threadId: string, userId: string, isTyping: boolean) {
    const threadRef = doc(db, 'threads', threadId);
    if (isTyping) {
      await updateDoc(threadRef, {
        typingUsers: arrayUnion(userId)
      });
      // Auto-remove typing status after timeout
      setTimeout(async () => {
        await updateDoc(threadRef, {
          typingUsers: arrayRemove(userId)
        });
      }, TYPING_TIMEOUT);
    } else {
      await updateDoc(threadRef, {
        typingUsers: arrayRemove(userId)
      });
    }
  }

  async updateUserPresence(userId: string, status: 'online' | 'offline') {
    const presenceRef = doc(db, 'presence', userId);
    await updateDoc(presenceRef, {
      status,
      lastSeen: serverTimestamp()
    });
  }

  subscribeToUserPresence(userId: string, callback: (presence: UserPresence) => void) {
    const presenceRef = doc(db, 'presence', userId);
    return onSnapshot(presenceRef, (doc) => {
      callback(doc.data() as UserPresence);
    });
  }

  async addReaction(messageId: string, userId: string, reaction: ReactionType) {
    const messageRef = doc(db, 'messages', messageId);
    await updateDoc(messageRef, {
      [`reactions.${userId}`]: reaction
    });
  }

  async removeReaction(messageId: string, userId: string) {
    const messageRef = doc(db, 'messages', messageId);
    await updateDoc(messageRef, {
      [`reactions.${userId}`]: null
    });
  }

  async markMessageAsSeen(messageId: string, userId: string) {
    const messageRef = doc(db, 'messages', messageId);
    await updateDoc(messageRef, {
      seenBy: arrayUnion(userId)
    });
  }

  async searchMessages(params: {
    query?: string,
    threadId?: string,
    startDate?: Date,
    endDate?: Date,
    type?: MessageType[],
    hasAttachments?: boolean,
    limit?: number
  }): Promise<Message[]> {
    const messagesRef = collection(db, 'messages');
    let q: Query<DocumentData> = messagesRef;

    if (params.threadId) {
      q = query(q, where('threadId', '==', params.threadId));
    }

    if (params.type && params.type.length > 0) {
      q = query(q, where('type', 'in', params.type));
    }

    if (params.startDate) {
      q = query(q, where('timestamp', '>=', params.startDate));
    }

    if (params.endDate) {
      q = query(q, where('timestamp', '<=', params.endDate));
    }

    if (params.hasAttachments) {
      q = query(q, where('attachments', '>', []));
    }

    if (params.limit) {
      q = query(q, limit(params.limit));
    }

    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Message));
  }

  async forwardMessage(
    originalMessageId: string,
    targetThreadId: string,
    senderId: string,
    receiverId: string
  ) {
    const originalMessage = await getDoc(doc(db, 'messages', originalMessageId));
    if (!originalMessage.exists()) throw new Error('Message not found');

    const messageData = originalMessage.data() as Message;
    
    return this.sendMessage(
      targetThreadId,
      senderId,
      receiverId,
      messageData.content,
      messageData.type,
      undefined,
      messageData.forwardedFrom
    );
  }

  async createGroupChat(name: string, participants: string[], createdBy: string): Promise<string> {
    const thread = await addDoc(collection(db, 'threads'), {
      type: 'group',
      name,
      participants,
      createdBy,
      createdAt: serverTimestamp(),
      unreadCount: participants.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}),
      admins: [createdBy],
      settings: {
        onlyAdminsCanPost: false,
        onlyAdminsCanAddMembers: true,
        onlyAdminsCanEditInfo: true
      }
    });
    return thread.id;
  }

  async addGroupMembers(threadId: string, userIds: string[], addedBy: string) {
    const threadRef = doc(db, 'threads', threadId);
    await updateDoc(threadRef, {
      participants: arrayUnion(...userIds)
    });
  }

  async removeGroupMember(threadId: string, userId: string) {
    const threadRef = doc(db, 'threads', threadId);
    await updateDoc(threadRef, {
      participants: arrayRemove(userId)
    });
  }

  async sendVoiceMessage(threadId: string, audioBlob: Blob, duration: number, waveform: number[]): Promise<string> {
    // Upload audio file to Firebase Storage
    const audioUrl = await this.uploadAudio(audioBlob);
    
    const message = await addDoc(collection(db, 'messages'), {
      threadId,
      type: 'voice',
      content: '',
      timestamp: serverTimestamp(),
      status: 'sent',
      seenBy: [],
      reactions: {},
      voiceMessage: {
        url: audioUrl,
        duration,
        waveform
      }
    });
    return message.id;
  }

  async replyToMessage(threadId: string, content: string, replyToId: string): Promise<string> {
    const message = await addDoc(collection(db, 'messages'), {
      threadId,
      content,
      timestamp: serverTimestamp(),
      status: 'sent',
      seenBy: [],
      reactions: {},
      replyTo: replyToId
    });
    return message.id;
  }

  async pinMessage(messageId: string, threadId: string) {
    const messageRef = doc(db, 'messages', messageId);
    const threadRef = doc(db, 'threads', threadId);
    
    await Promise.all([
      updateDoc(messageRef, {
        isPinned: true
      }),
      updateDoc(threadRef, {
        pinnedMessages: arrayUnion(messageId)
      })
    ]);
  }

  async unpinMessage(messageId: string, threadId: string) {
    const messageRef = doc(db, 'messages', messageId);
    const threadRef = doc(db, 'threads', threadId);
    
    await Promise.all([
      updateDoc(messageRef, {
        isPinned: false
      }),
      updateDoc(threadRef, {
        pinnedMessages: arrayRemove(messageId)
      })
    ]);
  }

  async bookmarkMessage(userId: string, messageId: string) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      bookmarkedMessages: arrayUnion(messageId)
    });
  }

  async unbookmarkMessage(userId: string, messageId: string) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      bookmarkedMessages: arrayRemove(messageId)
    });
  }

  async addCustomReaction(messageId: string, userId: string, emoji: string) {
    const messageRef = doc(db, 'messages', messageId);
    await updateDoc(messageRef, {
      [`reactions.${userId}`]: emoji
    });
  }

  async translateMessage(messageId: string, targetLanguage: string) {
    const messageRef = doc(db, 'messages', messageId);
    const message = await this.getMessage(messageId);
    
    // Here you would integrate with a translation service
    // For example, Google Cloud Translation API
    const translatedText = await this.translateText(message.content, targetLanguage);
    
    await updateDoc(messageRef, {
      [`translation.${targetLanguage}`]: translatedText
    });
  }

  private async uploadAudio(blob: Blob): Promise<string> {
    // Implement audio upload to Firebase Storage
    const storageRef = ref(storage, `audio/${uuidv4()}.mp3`);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  }

  private async translateText(text: string, targetLanguage: string): Promise<string> {
    // Implement translation service integration
    // This is a placeholder - implement actual translation service
    return text;
  }

  private async getMessage(messageId: string): Promise<Message> {
    const messageRef = doc(db, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);
    if (!messageSnap.exists()) {
      throw new Error('Message not found');
    }
    return { id: messageSnap.id, ...messageSnap.data() } as Message;
  }
}

// Export a singleton instance
export const messagesService = new MessageService(); 