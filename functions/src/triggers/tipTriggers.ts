import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Trigger when a new tip is created
 * - Send notification to the creator
 * - Log tip for analytics
 */
export const onTipCreated = functions.firestore
  .document('tips/{tipId}')
  .onCreate(async (snap, context) => {
    const tip = snap.data();
    const tipId = context.params.tipId;

    try {
      // Get creator and tipper information
      const [creatorDoc, tipperDoc] = await Promise.all([
        admin.firestore().collection('users').where('uid', '==', tip.creatorId).limit(1).get(),
        admin.firestore().collection('users').where('uid', '==', tip.tipperId).limit(1).get(),
      ]);

      if (creatorDoc.empty || tipperDoc.empty) {
        console.error('Creator or tipper not found');
        return;
      }

      const creator = creatorDoc.docs[0].data();
      const tipper = tipperDoc.docs[0].data();

      // Create notification for creator
      const notification = {
        type: 'tip',
        toUserId: tip.creatorId,
        fromUser: {
          uid: tip.tipperId,
          displayName: tipper.displayName || tipper.username || 'Someone',
          photoURL: tipper.photoURL || null,
          username: tipper.username || '',
        },
        message: `${tipper.displayName || tipper.username || 'Someone'} tipped you $${tip.amount.toFixed(2)}${tip.message ? `: "${tip.message}"` : ''}`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        tipId: tipId,
        amount: tip.amount,
        context: tip.context || null,
      };

      // Add notification to notifications collection
      await admin.firestore().collection('notifications').add(notification);

      // Also add to user's notifications subcollection
      await admin.firestore()
        .collection('users')
        .doc(creatorDoc.docs[0].id)
        .collection('notifications')
        .add(notification);

      // Send push notification if creator has FCM token
      if (creator.fcmToken) {
        try {
          await admin.messaging().send({
            token: creator.fcmToken,
            notification: {
              title: '💰 New Tip Received!',
              body: `${tipper.displayName || tipper.username} tipped you $${tip.amount.toFixed(2)}`,
            },
            data: {
              type: 'tip',
              tipId: tipId,
              amount: tip.amount.toString(),
              tipperId: tip.tipperId,
            },
          });
        } catch (error) {
          console.error('Error sending push notification:', error);
        }
      }

      console.log(`Tip notification created: ${tipId} - $${tip.amount} from ${tipper.displayName} to ${creator.displayName}`);
    } catch (error) {
      console.error('Error processing tip:', error);
    }
  });

/**
 * Track tip analytics
 * This could be used for platform-wide statistics
 */
export const onTipCreatedAnalytics = functions.firestore
  .document('tips/{tipId}')
  .onCreate(async (snap, context) => {
    const tip = snap.data();

    try {
      // Update creator's tip stats
      const creatorQuery = await admin.firestore()
        .collection('users')
        .where('uid', '==', tip.creatorId)
        .limit(1)
        .get();

      if (!creatorQuery.empty) {
        const creatorDocRef = creatorQuery.docs[0].ref;
        
        await creatorDocRef.update({
          'stats.totalTips': admin.firestore.FieldValue.increment(1),
          'stats.totalTipAmount': admin.firestore.FieldValue.increment(tip.amount),
          'stats.lastTipAt': admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Update platform-wide statistics
      const statsRef = admin.firestore().collection('platformStats').doc('tips');
      await statsRef.set({
        totalTips: admin.firestore.FieldValue.increment(1),
        totalAmount: admin.firestore.FieldValue.increment(tip.amount),
        lastTipAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      console.log(`Tip analytics updated for tip: ${context.params.tipId}`);
    } catch (error) {
      console.error('Error updating tip analytics:', error);
    }
  });

