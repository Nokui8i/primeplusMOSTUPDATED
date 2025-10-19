import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

// Scheduled function to check expiring subscriptions (24 hours before) and expired subscriptions (same day)
export const checkExpiringSubscriptions = functions.pubsub
  .schedule('every 24 hours')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = getFirestore();
    const now = new Date();
    
    try {
      console.log('[checkExpiringSubscriptions] Starting subscription check...');
      
      // Check expiring subscriptions (24 hours before)
      await checkExpiringSubscriptions24h(db, now);
      
      // Check expired subscriptions (same day)
      await checkExpiredSubscriptionsToday(db, now);
      
      console.log('[checkExpiringSubscriptions] Subscription check completed successfully');
      return null;
    } catch (error) {
      console.error('[checkExpiringSubscriptions] Error checking subscriptions:', error);
      throw error;
    }
  });

// Check subscriptions expiring in 24 hours
async function checkExpiringSubscriptions24h(db: any, now: Date) {
  try {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);
    
    console.log(`[checkExpiringSubscriptions] Checking subscriptions expiring between ${tomorrow.toISOString()} and ${endOfTomorrow.toISOString()}`);
    
    // Find subscriptions expiring tomorrow
    const subscriptionsSnapshot = await db.collection('subscriptions')
      .where('status', '==', 'active')
      .where('endDate', '>=', tomorrow)
      .where('endDate', '<=', endOfTomorrow)
      .get();
    
    console.log(`[checkExpiringSubscriptions] Found ${subscriptionsSnapshot.size} subscriptions expiring tomorrow`);
    
    for (const doc of subscriptionsSnapshot.docs) {
      const subscription = doc.data();
      
      // Get creator info
      const creatorDoc = await db.collection('users').doc(subscription.creatorId).get();
      const creatorName = creatorDoc.exists ? 
        (creatorDoc.data().displayName || creatorDoc.data().username || 'Unknown Creator') : 
        'Unknown Creator';
      
      // Send notification to subscriber
      await sendNotification(db, subscription.subscriberId, {
        type: 'subscription_expiring',
        title: 'Subscription Expiring Soon',
        message: `Your subscription to ${creatorName} expires in 24 hours`,
        data: {
          subscriptionId: doc.id,
          creatorId: subscription.creatorId,
          creatorName: creatorName,
          expiresAt: subscription.endDate
        }
      });
      
      console.log(`[checkExpiringSubscriptions] Sent expiring notification to user ${subscription.subscriberId}`);
    }
    
    return { success: true, count: subscriptionsSnapshot.size };
  } catch (error) {
    console.error('[checkExpiringSubscriptions] Error checking expiring subscriptions:', error);
    throw error;
  }
}

// Check subscriptions that expired today
async function checkExpiredSubscriptionsToday(db: any, now: Date) {
  try {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    
    console.log(`[checkExpiringSubscriptions] Checking subscriptions that expired between ${today.toISOString()} and ${endOfToday.toISOString()}`);
    
    // Find subscriptions that expired today
    const subscriptionsSnapshot = await db.collection('subscriptions')
      .where('status', '==', 'active')
      .where('endDate', '>=', today)
      .where('endDate', '<=', endOfToday)
      .get();
    
    console.log(`[checkExpiringSubscriptions] Found ${subscriptionsSnapshot.size} subscriptions that expired today`);
    
    for (const doc of subscriptionsSnapshot.docs) {
      const subscription = doc.data();
      
      // Get creator info
      const creatorDoc = await db.collection('users').doc(subscription.creatorId).get();
      const creatorName = creatorDoc.exists ? 
        (creatorDoc.data().displayName || creatorDoc.data().username || 'Unknown Creator') : 
        'Unknown Creator';
      
      // Send notification to subscriber
      await sendNotification(db, subscription.subscriberId, {
        type: 'subscription_expired',
        title: 'Subscription Expired',
        message: `Your subscription to ${creatorName} has expired`,
        data: {
          subscriptionId: doc.id,
          creatorId: subscription.creatorId,
          creatorName: creatorName,
          expiredAt: subscription.endDate
        }
      });
      
      // Update subscription status to expired
      await doc.ref.update({
        status: 'expired',
        updatedAt: new Date()
      });
      
      console.log(`[checkExpiringSubscriptions] Sent expired notification to user ${subscription.subscriberId} and updated status`);
    }
    
    return { success: true, count: subscriptionsSnapshot.size };
  } catch (error) {
    console.error('[checkExpiringSubscriptions] Error checking expired subscriptions:', error);
    throw error;
  }
}

// Helper function to send notifications
async function sendNotification(db: any, userId: string, notification: any) {
  try {
    await db.collection('notifications').add({
      ...notification,
      userId: userId,
      read: false,
      createdAt: new Date()
    });
    console.log(`[checkExpiringSubscriptions] Notification sent to user ${userId}: ${notification.title}`);
  } catch (error) {
    console.error(`[checkExpiringSubscriptions] Error sending notification to user ${userId}:`, error);
  }
}
