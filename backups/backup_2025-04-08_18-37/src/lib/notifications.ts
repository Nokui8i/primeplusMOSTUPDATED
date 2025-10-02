import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';

export interface Notification {
  id: string;
  type: 'follow' | 'like' | 'comment';
  fromUserId: string;
  toUserId: string;
  read: boolean;
  createdAt: Date;
  fromUser?: {
    displayName: string;
    photoURL?: string;
    username?: string;
  };
}

export async function createFollowNotification(fromUserId: string, toUserId: string) {
  try {
    await addDoc(collection(db, 'notifications'), {
      type: 'follow',
      fromUserId,
      toUserId,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

export function useNotifications(userId: string, callback: (notifications: Notification[]) => void) {
  const q = query(
    collection(db, 'notifications'),
    where('toUserId', '==', userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(10)
  );

  return onSnapshot(q, async (snapshot) => {
    const notifications: Notification[] = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const fromUserDoc = await getDoc(doc(db, 'users', data.fromUserId));
      const fromUserData = fromUserDoc.data();
      
      notifications.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        fromUser: fromUserData ? {
          displayName: fromUserData.displayName,
          photoURL: fromUserData.photoURL,
          username: fromUserData.username,
        } : undefined,
      } as Notification);
    }
    
    callback(notifications);
  });
} 