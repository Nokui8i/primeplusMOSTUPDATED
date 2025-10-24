import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Function to get Firestore instance, ensuring app is initialized
const getDb = () => {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  return admin.firestore();
};

export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const db = getDb(); // Get DB instance when function is invoked
  const { uid, email, displayName, photoURL } = user;

  const newUserDocRef = db.collection('users').doc(uid);
  const batch = db.batch();

  // 1. Create the user document (no plan creation)
  batch.set(newUserDocRef, {
    uid: uid,
    email: email || null,
    displayName: displayName || email?.split('@')[0] || 'New User', // Default display name
    username: (displayName || email?.split('@')[0] || uid.substring(0, 8)).replace(/\s+/g, '').toLowerCase(), // Default username
    photoURL: photoURL || null, // Default photo URL (can be a placeholder)
    // Optionally set default coverPhotoUrl/profilePhotoUrl here if needed
    role: 'user', // All users are users by default
    isActive: true, // Ensure all new users are active by default
    followersCount: 0, // Initialize followers counter
    followingCount: 0, // Initialize following counter
    profileCompleted: true, // Mark profile as completed by default
    privacy: {
      profileVisibility: 'public', // Default to public profile visibility
      allowComments: true,
      allowTagging: true,
      showActivityStatus: true,
      onlineStatus: 'everyone'
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    // Add any other fields needed for the follow system only
  });

  try {
    await batch.commit();
    console.log(`User ${uid} successfully created as creator with default plan.`);
  } catch (error) {
    console.error(`Error setting up new user ${uid} as creator:`, error);
    // Optional: attempt to clean up if one part of the batch failed, though it's tricky.
    // Or log for manual intervention.
  }
}); 