import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

export const restoreUserRoles = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const db = getFirestore();
    const now = new Date();
    
    try {
      // Query for users with expired downgrades
      const usersSnapshot = await db.collection('users')
        .where('downgradeUntil', '<=', now.toISOString())
        .where('downgradedFrom', '!=', null)
        .get();

      const batch = db.batch();
      let restoredCount = 0;

      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        if (userData.downgradedFrom) {
          // Restore the previous role
          batch.update(doc.ref, {
            role: userData.downgradedFrom,
            downgradedFrom: null,
            downgradeUntil: null,
            lastRoleRestored: now.toISOString()
          });
          restoredCount++;

          // Add to audit log
          const auditLogRef = db.collection('auditLogs').doc();
          batch.set(auditLogRef, {
            action: 'role_restored',
            userId: doc.id,
            previousRole: userData.role,
            newRole: userData.downgradedFrom,
            restoredAt: now.toISOString(),
            reason: 'automatic_restoration',
            performedBy: 'system'
          });
        }
      }

      if (restoredCount > 0) {
        await batch.commit();
        console.log(`Successfully restored roles for ${restoredCount} users`);
      }

      return null;
    } catch (error) {
      console.error('Error in restoreUserRoles:', error);
      throw error;
    }
  }); 