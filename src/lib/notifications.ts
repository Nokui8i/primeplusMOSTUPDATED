'use client';

import { db } from '@/lib/firebase';
import { collection, doc, query, where, orderBy, limit, onSnapshot, addDoc, updateDoc, Timestamp, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface UserInfo {
  uid: string;
  displayName: string;
  photoURL?: string;
  nickname?: string;
}

export interface NotificationData {
  postId?: string;
  userId?: string;
  commentId?: string;
  text?: string;
  postContent?: string;
  timestamp: Timestamp;
  contentType?: string;
  isCommand?: boolean;
  message?: string;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow';
  fromUser: {
    uid: string;
    displayName: string;
    photoURL: string;
  };
  toUser: string;
  data: NotificationData;
  read: boolean;
  createdAt: Timestamp;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    // Query both global and user-specific notifications
    const globalQ = query(
      collection(db, 'notifications'),
      where('toUserId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const userQ = query(
      collection(db, `users/${user.uid}/notifications`),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    // Set up real-time listeners
    const unsubscribeGlobal = onSnapshot(globalQ, (snapshot) => {
      const globalNotifs: Notification[] = [];
      
      for (const docSnapshot of snapshot.docs) {
        const notifData = docSnapshot.data() as Omit<Notification, 'id'>;
        globalNotifs.push({
          id: docSnapshot.id,
          ...notifData
        });
      }
      
      setNotifications(prev => {
        const userNotifs = prev.filter(n => !n.id.startsWith('global-'));
        const combined = [...userNotifs, ...globalNotifs];
        return combined.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      });
      
      setUnreadCount(prev => {
        const unread = globalNotifs.filter((n: Notification) => !n.read).length;
        return unread;
      });
    }, (error) => {
      console.error('Error fetching global notifications:', error);
    });

    const unsubscribeUser = onSnapshot(userQ, (snapshot) => {
      const userNotifs: Notification[] = [];
      
      for (const docSnapshot of snapshot.docs) {
        const notifData = docSnapshot.data() as Omit<Notification, 'id'>;
        userNotifs.push({
          id: `user-${docSnapshot.id}`,
          ...notifData
        });
      }
      
      setNotifications(prev => {
        const globalNotifs = prev.filter(n => n.id.startsWith('global-'));
        const combined = [...globalNotifs, ...userNotifs];
        return combined.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      });
      
      setUnreadCount(prev => {
        const unread = userNotifs.filter((n: Notification) => !n.read).length;
        return unread;
      });
    }, (error) => {
      console.error('Error fetching user notifications:', error);
    });

    setLoading(false);

    return () => {
      unsubscribeGlobal();
      unsubscribeUser();
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    if (notificationId.startsWith('user-')) {
      const actualId = notificationId.replace('user-', '');
      const notifRef = doc(db, `users/${user?.uid}/notifications`, actualId);
      await updateDoc(notifRef, { read: true });
    } else {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, { read: true });
    }
  };

  const markAllAsRead = async () => {
    const promises = notifications
      .filter(n => !n.read)
      .map(n => markAsRead(n.id));
    await Promise.all(promises);
  };

  const deleteNotification = async (notificationId: string) => {
    if (notificationId.startsWith('user-')) {
      const actualId = notificationId.replace('user-', '');
      const notifRef = doc(db, `users/${user?.uid}/notifications`, actualId);
      await deleteDoc(notifRef);
    } else {
      const notifRef = doc(db, 'notifications', notificationId);
      await deleteDoc(notifRef);
    }
  };

  const deleteAllNotifications = async () => {
    const promises = notifications.map(n => deleteNotification(n.id));
    await Promise.all(promises);
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications
  };
};

export const createNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...notification,
      read: false,
      createdAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export async function getNotifications(userId: string): Promise<Notification[]> {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    const notifications: Notification[] = [];

    for (const docSnapshot of snapshot.docs) {
      const notifData = docSnapshot.data() as Omit<Notification, 'id'>;
      
      // The fromUser data is already included in the notification
      notifications.push({
        id: docSnapshot.id,
        ...notifData
      });
    }

    return notifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
} 