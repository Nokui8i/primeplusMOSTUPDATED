const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp({
    storageBucket: 'primeplus-11a85.firebasestorage.app'
  });
}
const db = admin.firestore();
const storage = admin.storage();
const bucket = storage.bucket('primeplus-11a85.firebasestorage.app');

async function cleanupOrphanedData() {
  // 1. Clean up orphaned verificationData documents
  const verificationSnap = await db.collection('verificationData').get();
  let orphanedDocs = 0;
  for (const doc of verificationSnap.docs) {
    const data = doc.data();
    const userId = data.userId;
    if (!userId) {
      await doc.ref.delete();
      orphanedDocs++;
      console.log(`Deleted verificationData doc with missing userId: ${doc.id}`);
      continue;
    }
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      await doc.ref.delete();
      orphanedDocs++;
      console.log(`Deleted orphaned verificationData doc for user: ${userId}`);
    }
  }

  // 2. Clean up orphaned verification files in Storage
  const [files] = await bucket.getFiles({ prefix: 'verification/' });
  let orphanedFiles = 0;
  for (const file of files) {
    // Path: verification/{userId}/...
    const match = file.name.match(/^verification\/([^/]+)\//);
    if (!match) continue;
    const userId = match[1];
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      await file.delete({ ignoreNotFound: true });
      orphanedFiles++;
      console.log(`Deleted orphaned verification file: ${file.name}`);
    }
  }

  console.log(`Cleanup complete. Deleted ${orphanedDocs} orphaned verificationData docs and ${orphanedFiles} orphaned files.`);
}

cleanupOrphanedData().catch(console.error); 