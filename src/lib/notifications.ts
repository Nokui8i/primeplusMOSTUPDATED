import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot, doc, getDoc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { useState, useEffect } from 'react';

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

export async function createNotification(notificationData: Omit<Notification, 'id' | 'createdAt'>) {
  try {
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...notificationData,
      createdAt: serverTimestamp(),
    });
    console.log('🔔 Notification created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// Test function to create a sample notification
export async function createTestNotification(toUserId: string, fromUserId: string) {
  try {
    const notificationData = {
      type: 'like' as const,
      fromUserId,
      toUserId,
      read: false,
      data: {
        message: 'Test notification',
        postId: 'test-post-123'
      }
    };
    
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...notificationData,
      createdAt: serverTimestamp(),
    });
    
    console.log('🔔 Test notification created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating test notification:', error);
  }
}

// Mark a single notification as read
export async function markNotificationAsRead(notificationId: string) {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true
    });
    console.log('🔔 Notification marked as read:', notificationId);
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

// Mark all notifications as read for a user
export async function markAllNotificationsAsRead(userId: string) {
  try {
    // Get all unread notifications for the user
    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', userId),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('🔔 No unread notifications to mark as read');
      return;
    }
    
    // Use batch update for better performance
    const batch = writeBatch(db);
    
    snapshot.forEach((docSnapshot) => {
      batch.update(docSnapshot.ref, { read: true });
    });
    
    await batch.commit();
    console.log('🔔 Marked', snapshot.size, 'notifications as read for user:', userId);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

export function useNotifications(userId: string, callback: (notifications: Notification[]) => void) {
  // Don't create query if userId is empty or undefined
  if (!userId || !callback) {
    return () => {}; // Return empty unsubscribe function
  }

  // Use useEffect to call callback to avoid calling during render
  useEffect(() => {
    console.log('🔔 useNotifications: Setting up Firebase listener for userId:', userId);
    
    // Create Firebase query for notifications
    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications: Notification[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        try {
          // Extract fromUserId from either direct field or nested fromUser.uid
          const fromUserId = data.fromUserId || data.fromUser?.uid;
          
          // Validate notification data
          if (fromUserId && data.toUserId && data.type) {
            notifications.push({
              id: doc.id,
              type: data.type,
              fromUserId: fromUserId,
              toUserId: data.toUserId,
              read: data.read || false,
              data: data.data || {},
              createdAt: data.createdAt?.toDate() || new Date(),
              fromUser: data.fromUser // Include the full fromUser object if available
            });
          } else {
            console.warn('🔔 Skipping malformed notification:', doc.id, 'Data:', JSON.stringify(data, null, 2));
          }
        } catch (error) {
          console.error('🔔 Error processing notification:', doc.id, error);
        }
      });

      console.log('🔔 useNotifications: Fetched', notifications.length, 'notifications');
      callback(notifications);
    }, (error) => {
      console.error('🔔 useNotifications: Firebase error:', error);
      callback([]); // Return empty array on error
    });

    return unsubscribe;
  }, [userId, callback]);

  return () => {}; // Return empty unsubscribe function
}

// Hook for the notifications page that returns an object
export function useNotificationsPage(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    console.log('🔔 useNotificationsPage: Setting up Firebase listener for userId:', userId);
    setLoading(true);
    
    // Create Firebase query for notifications
    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications: Notification[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        try {
          // Extract fromUserId from either direct field or nested fromUser.uid
          const fromUserId = data.fromUserId || data.fromUser?.uid;
          
          // Validate notification data
          if (fromUserId && data.toUserId && data.type) {
            notifications.push({
              id: doc.id,
              type: data.type,
              fromUserId: fromUserId,
              toUserId: data.toUserId,
              read: data.read || false,
              data: data.data || {},
              createdAt: data.createdAt?.toDate() || new Date(),
              fromUser: data.fromUser // Include the full fromUser object if available
            });
          } else {
            console.warn('🔔 Skipping malformed notification:', doc.id, data);
          }
        } catch (error) {
          console.error('🔔 Error processing notification:', doc.id, error);
        }
      });

      console.log('🔔 useNotificationsPage: Fetched', notifications.length, 'notifications');
      setNotifications(notifications);
      setLoading(false);
    }, (error) => {
      console.error('🔔 useNotificationsPage: Firebase error:', error);
      setNotifications([]);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const deleteNotification = async (notificationId: string) => {
    // TODO: Implement delete notification
    console.log('Delete notification:', notificationId);
  };

  const deleteAllNotifications = async () => {
    // TODO: Implement delete all notifications
    console.log('Delete all notifications');
  };

  return {
    notifications,
    loading,
    deleteNotification,
    deleteAllNotifications
  };
} 