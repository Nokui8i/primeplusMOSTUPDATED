import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Function to get Firestore instance, ensuring app is initialized
const getDb = () => {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  return admin.firestore();
};

export const setupExistingUsers = functions.https.onRequest(async (request, response) => {
  const db = getDb(); // Get DB instance when function is invoked
  // IMPORTANT: Add security checks here in a real-world scenario!
  // For example, check if the caller is an admin:
  // if (!request.auth || !request.auth.token.admin) {
  //   console.warn('Unauthorized attempt to run setupExistingUsers');
  //   response.status(403).send('Unauthorized');
  //   return;
  // }

  console.log('Starting setup for existing users...');
  let updatedUsersCount = 0;
  let plansCreatedCount = 0;
  let usersSkippedCount = 0;
  const errors: string[] = [];

  try {
    const usersSnapshot = await db.collection('users').get();

    if (usersSnapshot.empty) {
      console.log('No users found in the database.');
      response.status(200).send('No users found to process.');
      return;
    }

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Prepare user document update data
      const userUpdateData: { [key: string]: any } = {
        role: 'creator',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      // Ensure all fields from onUserCreate are considered if missing
      if (!userData.email) userUpdateData.email = null; // or some default
      if (!userData.displayName) userUpdateData.displayName = userData.email?.split('@')[0] || 'Existing User';
      if (!userData.photoURL) userUpdateData.photoURL = null;
      if (!userData.createdAt) userUpdateData.createdAt = admin.firestore.FieldValue.serverTimestamp(); // If somehow missing
      if (typeof userData.followersCount !== 'number' || userData.followersCount < 0) userUpdateData.followersCount = 0;
      if (typeof userData.followingCount !== 'number' || userData.followingCount < 0) userUpdateData.followingCount = 0;

      const batch = db.batch();
      batch.update(db.collection('users').doc(userId), userUpdateData);

      try {
        await batch.commit();
        updatedUsersCount++;
      } catch (batchError) {
        errors.push(`User ${userId}: ${(batchError as Error).message}`);
      }
    }

    const summary = `Setup complete. Users updated/verified: ${updatedUsersCount}. New plans created: ${plansCreatedCount}. Users skipped: ${usersSkippedCount}. Errors: ${errors.length}`;
    console.log(summary);
    if (errors.length > 0) {
      console.error("Errors encountered:", errors);
      response.status(500).send({ message: summary, errors: errors });
    } else {
      response.status(200).send(summary);
    }

  } catch (error) {
    console.error('Critical error during setupExistingUsers:', error);
    response.status(500).send('Failed to process existing users. Check logs.');
  }
}); 