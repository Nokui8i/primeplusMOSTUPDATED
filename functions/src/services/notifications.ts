import { messaging as adminMessaging, db as adminDb } from '../firebase-admin';

export async function sendPushNotification(toUserId: string, notification: any) {
  try {
    // Get the user's notification settings and FCM token
    const userDoc = await adminDb.collection('users').doc(toUserId).get();
    const userData = userDoc.data();
    if (!userData) {
      console.log('User not found:', toUserId);
      return;
    }

    // Check if push notifications are enabled for this type
    const pushSettings = userData.notifications?.push || {};
    
    // Map notification types to settings
    const typeToSetting: { [key: string]: string } = {
      'like': 'likes',
      'comment': 'comment',
      'follow': 'follows',
      'mention': 'mentions'
    };

    const settingKey = typeToSetting[notification.type];
    if (!settingKey) {
      console.log('Unknown notification type:', notification.type);
      return;
    }

    const allowed = !!pushSettings[settingKey];
    console.log('Push settings:', pushSettings, 'Notification type:', notification.type, 'Setting key:', settingKey, 'Allowed:', allowed);
    
    if (!allowed) {
      console.log('Push notification blocked by user settings');
      return;
    }

    // Check for FCM token
    const fcmToken = userData.fcmToken;
    if (!fcmToken) {
      console.log('No FCM token found for user');
      return;
    }

    // Compose notification payload
    const payload = {
      notification: {
        title: notification.title || 'PrimePlus+',
        body: notification.body || 'You have a new notification',
        icon: '/icon-192x192.png',
      },
      data: {
        type: notification.type,
        ...notification.data,
      },
      token: fcmToken,
    };

    // Send push notification
    await adminMessaging.send(payload);
    console.log('Push notification sent successfully to:', toUserId);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}
