import { collection, query, where, orderBy, getDocs, doc, getDoc, DocumentData, QueryDocumentSnapshot, Timestamp } from 'firebase/firestore';
import { db } from './config';

export interface Chat {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: Date;
  lastMessageSender: string;
  otherParticipant: {
    id: string;
    displayName: string;
    photoURL: string;
    username: string;
  };
}

interface UserData {
  displayName: string;
  photoURL: string;
  username: string;
}

interface ChatData {
  participants: string[];
  lastMessage: string;
  lastMessageTime: Timestamp;
  lastMessageSender: string;
}

export async function getUserChats(userId: string): Promise<Chat[]> {
  try {
    console.log('Fetching chats for user:', userId);
    
    // First verify the user exists
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('User not found:', userId);
      return [];
    }

    // Create the query with proper error handling
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId),
      orderBy('lastMessageTime', 'desc')
    );

    console.log('Executing chat query...');
    const snapshot = await getDocs(chatsQuery);
    console.log('Query returned', snapshot.docs.length, 'chats');

    const chats = await Promise.all(
      snapshot.docs.map(async (docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnapshot.data() as ChatData;
        console.log('Processing chat:', docSnapshot.id, data);
        
        // Get the other participant's details
        const otherParticipantId = data.participants.find((id: string) => id !== userId);
        if (!otherParticipantId) {
          console.warn('No other participant found in chat:', docSnapshot.id);
          return null;
        }

        const otherUserRef = doc(db, 'users', otherParticipantId);
        const otherUserDoc = await getDoc(otherUserRef);
        
        if (!otherUserDoc.exists()) {
          console.warn('Other participant not found:', otherParticipantId);
          return null;
        }

        const otherUserData = otherUserDoc.data() as UserData;
        
        return {
          id: docSnapshot.id,
          participants: data.participants,
          lastMessage: data.lastMessage || '',
          lastMessageTime: data.lastMessageTime?.toDate() || new Date(),
          lastMessageSender: data.lastMessageSender || '',
          otherParticipant: {
            id: otherParticipantId,
            displayName: otherUserData.displayName || '',
            photoURL: otherUserData.photoURL || '',
            username: otherUserData.username || ''
          }
        };
      })
    );

    // Filter out any null chats and sort by lastMessageTime
    const validChats = chats.filter((chat): chat is Chat => chat !== null)
      .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

    console.log('Processed chats:', validChats.length);
    return validChats;
  } catch (error) {
    console.error('Error fetching user chats:', error);
    // Return empty array instead of throwing to prevent UI crashes
    return [];
  }
} 