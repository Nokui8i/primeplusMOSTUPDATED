import * as functions from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as admin from 'firebase-admin';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';

const corsHandler = cors({ origin: true });

// Helper: log audit event
async function logAudit(action: string, userId: string, performedBy: string, metadata: any = {}) {
  const db = getFirestore();
  await db.collection('auditLogs').add({
    action,
    userId,
    performedBy,
    timestamp: new Date().toISOString(),
    metadata,
  });
}

// 1. Reset User Password (send reset email)
export const resetUserPassword = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
  const { userId, email } = data;
  if (!userId || !email) throw new functions.https.HttpsError('invalid-argument', 'Missing userId or email');
  // Only allow admin roles
  const requester = await getAuth().getUser(context.auth.uid);
  const requesterRole = requester.customClaims?.role || null;
  if (!['admin', 'superadmin', 'owner'].includes(requesterRole)) {
    throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
  }
  const link = await getAuth().generatePasswordResetLink(email);
  await logAudit('reset_password', userId, context.auth.uid, { email });
  return { success: true, link };
});

// 2. Force Logout (revoke refresh tokens)
export const forceLogoutUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
  const { userId } = data;
  if (!userId) throw new functions.https.HttpsError('invalid-argument', 'Missing userId');
  const requester = await getAuth().getUser(context.auth.uid);
  const requesterRole = requester.customClaims?.role || null;
  if (!['admin', 'superadmin', 'owner'].includes(requesterRole)) {
    throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
  }
  await getAuth().revokeRefreshTokens(userId);
  await logAudit('force_logout', userId, context.auth.uid);
  return { success: true };
});

// 3. Change Display Name
export const changeUserDisplayName = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
  const { userId, newDisplayName } = data;
  if (!userId || !newDisplayName) throw new functions.https.HttpsError('invalid-argument', 'Missing userId or newDisplayName');
  const requester = await getAuth().getUser(context.auth.uid);
  const requesterRole = requester.customClaims?.role || null;
  if (!['admin', 'superadmin', 'owner'].includes(requesterRole)) {
    throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
  }
  await getAuth().updateUser(userId, { displayName: newDisplayName });
  await logAudit('change_display_name', userId, context.auth.uid, { newDisplayName });
  return { success: true };
});

// 4. Delete creator verification files and Firestore document
export const deleteCreatorVerificationData = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
  const { userId } = data;
  if (!userId) throw new functions.https.HttpsError('invalid-argument', 'Missing userId');
  // Only allow admin roles
  const requester = await getAuth().getUser(context.auth.uid);
  const requesterRole = requester.customClaims?.role || null;
  if (!['admin', 'superadmin', 'owner'].includes(requesterRole)) {
    throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
  }
  const db = getFirestore();
  const verificationSnap = await db.collection('verificationData').where('userId', '==', userId).get();
  if (verificationSnap.empty) return { success: true };
  const storage = getStorage();
  for (const doc of verificationSnap.docs) {
    const data = doc.data();
    // Delete file from Storage if present
    if (data.idDocumentUrl) {
      try {
        const url = new URL(data.idDocumentUrl);
        // Extract the path after '/o/' and before '?'
        const path = decodeURIComponent(url.pathname.split('/o/')[1]);
        await storage.bucket().file(path).delete();
      } catch (err) {
        // Ignore file not found errors
      }
    }
    await doc.ref.delete();
  }
  return { success: true };
});

// New onRequest function for CORS support
export const deleteCreatorVerificationDataHttp = onRequest(async (req, res) => {
  // --- CORS HEADERS: Set for ALL requests ---
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    // Preflight request: respond with only headers, no body
    res.status(204).end();
    return;
  }

  try {
    const { userId } = req.body;
    if (!userId) {
      console.log('Missing userId in request body');
      res.status(400).json({ error: 'Missing userId' });
      return;
    }
    const db = getFirestore();
    const verificationSnap = await db.collection('verificationData').where('userId', '==', userId).get();
    console.log(`Found ${verificationSnap.size} verificationData docs for userId: ${userId}`);
    if (verificationSnap.empty) {
      res.json({ success: true, message: 'No verificationData docs found.' });
      return;
    }
    const storage = getStorage();
    for (const doc of verificationSnap.docs) {
      const data = doc.data();
      console.log(`Deleting verificationData doc: ${doc.id}`);
      if (data.idDocumentUrl) {
        try {
          const url = new URL(data.idDocumentUrl);
          const path = decodeURIComponent(url.pathname.split('/o/')[1]);
          await storage.bucket().file(path).delete();
          console.log(`Deleted file from storage: ${path}`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.log(`Failed to delete file: ${errorMsg}`);
        }
      }
      await doc.ref.delete();
      console.log(`Deleted Firestore doc: ${doc.id}`);
    }
    res.json({ success: true, message: 'Deleted verificationData docs and files.' });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Function error:', errorMsg);
    res.status(500).json({ error: 'Internal server error' });
  }
}); 