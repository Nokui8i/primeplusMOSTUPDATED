const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp({
    storageBucket: 'primeplus-11a85.firebasestorage.app' // Correct bucket name from Firebase Console
  });
}
const db = admin.firestore();
const storage = admin.storage();
const bucket = storage.bucket('primeplus-11a85.firebasestorage.app'); // Explicitly specify correct bucket

async function cleanupRejectedVerification() {
  const usersSnapshot = await db.collection('users').get();
  let cleanedUsers = 0;
  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data();
    const uid = userDoc.id;
    const status = user.verificationStatus;
    if (status !== 'pending' && status !== 'verified') {
      // Delete ALL files in verification/{uid}/
      const prefix = `verification/${uid}/`;
      const [files] = await bucket.getFiles({ prefix });
      for (const file of files) {
        await file.delete({ ignoreNotFound: true });
        console.log(`Deleted file ${file.name} for user: ${uid}`);
      }
      // Remove verificationData from user doc and set status to 'unverified'
      await userDoc.ref.update({
        verificationData: admin.firestore.FieldValue.delete(),
        verificationStatus: 'unverified',
      });
      // Delete verificationData Firestore docs
      const vSnap = await db.collection('verificationData').where('userId', '==', uid).get();
      for (const vDoc of vSnap.docs) {
        await vDoc.ref.delete();
        console.log(`Deleted verificationData doc for user: ${uid}`);
      }
      cleanedUsers++;
    }
  }
  console.log(`Cleanup complete. Cleaned ${cleanedUsers} users.`);
}

cleanupRejectedVerification().catch(console.error); 