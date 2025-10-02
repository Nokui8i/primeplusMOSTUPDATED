const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

async function cleanupVerificationData() {
  const verificationSnapshot = await db.collection('verificationData').get();
  let deletedCount = 0;
  for (const doc of verificationSnapshot.docs) {
    const data = doc.data();
    const userId = data.userId;
    if (!userId) {
      await doc.ref.delete();
      deletedCount++;
      console.log(`Deleted application with missing userId: ${doc.id}`);
      continue;
    }
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      await doc.ref.delete();
      deletedCount++;
      console.log(`Deleted application for non-existent user: ${userId}`);
      continue;
    }
    const user = userDoc.data();
    // Only keep if user is both a creator AND verified
    if (!(user.role === 'creator' && user.verificationStatus === 'verified')) {
      await doc.ref.delete();
      deletedCount++;
      console.log(`Deleted application for user ${userId} (role: ${user.role}, status: ${user.verificationStatus})`);
    }
  }
  console.log(`Cleanup complete. Deleted ${deletedCount} verificationData documents.`);
}

cleanupVerificationData().catch(console.error); 