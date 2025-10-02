const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

async function cleanup() {
  const usersSnapshot = await db.collection('users').get();
  let usersUpdated = 0;
  let plansDeleted = 0;

  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data();
    const uid = userDoc.id;
    const isVerifiedCreator = user.verificationStatus === 'verified' || user.role === 'creator';
    let updateNeeded = false;
    const updateData = {};

    // If not a verified creator, set role to 'user' and remove plan fields
    if (!isVerifiedCreator) {
      if (user.role !== 'user') {
        updateData.role = 'user';
        updateNeeded = true;
      }
      if (user.defaultSubscriptionPlanId) {
        updateData.defaultSubscriptionPlanId = admin.firestore.FieldValue.delete();
        updateNeeded = true;
      }
      if (user.defaultSubscriptionType) {
        updateData.defaultSubscriptionType = admin.firestore.FieldValue.delete();
        updateNeeded = true;
      }
      // Delete default plan if it exists
      const defaultPlanId = `plan_free_${uid}`;
      const planRef = db.collection('plans').doc(defaultPlanId);
      const planDoc = await planRef.get();
      if (planDoc.exists) {
        await planRef.delete();
        plansDeleted++;
        console.log(`Deleted plan: ${defaultPlanId}`);
      }
    }
    if (updateNeeded) {
      await userDoc.ref.update(updateData);
      usersUpdated++;
      console.log(`Updated user: ${uid}`);
    }
  }
  console.log(`Cleanup complete. Users updated: ${usersUpdated}, Plans deleted: ${plansDeleted}`);
}

cleanup().catch(console.error); 