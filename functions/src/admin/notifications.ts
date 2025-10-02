import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';

export type NotificationType =
  | 'creator_submitted'
  | 'creator_approved'
  | 'creator_rejected'
  | 'role_changed'
  | 'banned'
  | 'unbanned';

export interface Notification {
  userId: string;
  type: NotificationType;
  message: string;
  createdAt: any; // Accepts Firestore Timestamp
  read: boolean;
  metadata?: Record<string, any>;
}

export async function sendNotification(userId: string, type: NotificationType, message: string, metadata: Record<string, any> = {}) {
  const db = getFirestore();
  const notification: Notification & { toUserId: string } = {
    userId,
    toUserId: userId,
    type,
    message,
    createdAt: FieldValue.serverTimestamp(),
    read: false,
    metadata,
  };
  await db.collection('users').doc(userId).collection('notifications').add(notification);
}

export const sendNotificationHttp = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const { userId, type, message, metadata } = req.body;
    if (!userId || !type || !message) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    await sendNotification(userId, type, message, metadata || {});
    res.json({ success: true });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('sendNotificationHttp error:', errorMsg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Example usage in admin actions:
// await sendNotification(userId, 'creator_approved', 'Your creator application has been approved!');
// await sendNotification(userId, 'banned', 'Your account has been banned.', { reason: 'violation' }); 