import { Timestamp } from 'firebase/firestore';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file';
export type MessageStatus = 'sent' | 'delivered' | 'read';
export type ReactionType = '👍' | '❤️' | '😂' | '😮' | '😢' | '😡' | string;

export interface MessageAttachment {
  url: string;
  type: string;
  name: string;
  size: number;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  timestamp: Timestamp;
  attachments?: MessageAttachment[];
  seenBy: string[];
  reactions: Record<string, ReactionType>;
  forwardedFrom?: string;
  isEdited?: boolean;
  editedAt?: Timestamp;
  editHistory?: Array<{
    content: string;
    timestamp: Timestamp;
  }>;
}

export interface Thread {
  id: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: Record<string, number>;
  typingUsers: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  name?: string;
  isGroup?: boolean;
  pinnedMessages?: string[];
}

export interface UserPresence {
  status: 'online' | 'offline';
  lastSeen: Timestamp;
}

export interface TypingIndicator {
  threadId: string;
  userId: string;
  timestamp: Timestamp;
}

export interface MessageReaction {
  messageId: string;
  userId: string;
  reaction: ReactionType;
  timestamp: Timestamp;
} 