const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, getDocs, doc, getDoc, updateDoc, writeBatch } = require('firebase/firestore');

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateExistingCommentsDisplayNames() {
  try {
    console.log('Starting comment display names migration...');
    
    // Get all posts
    const postsRef = collection(db, 'posts');
    const postsSnapshot = await getDocs(postsRef);
    
    let totalComments = 0;
    let updatedComments = 0;
    const batchArray = [];
    let currentBatch = writeBatch(db);
    let operationCount = 0;
    
    for (const postDoc of postsSnapshot.docs) {
      const commentsRef = collection(db, `posts/${postDoc.id}/comments`);
      const commentsSnapshot = await getDocs(commentsRef);
      
      totalComments += commentsSnapshot.size;
      
      for (const commentDoc of commentsSnapshot.docs) {
        const commentData = commentDoc.data();
        
        // Get user profile
        const userDoc = await getDoc(doc(db, 'users', commentData.userId));
        const userData = userDoc.data();
        
        // Determine the correct display name
        const displayName = userData?.displayName || userData?.nickname || commentData.userDisplayName;
        
        // Only update if the display name is different and not empty
        if (displayName && displayName !== 'Anonymous User' && displayName !== commentData.userDisplayName) {
          // If we've reached the batch limit, commit and create a new batch
          if (operationCount >= 499) { // Firestore limit is 500 operations per batch
            batchArray.push(currentBatch);
            currentBatch = writeBatch(db);
            operationCount = 0;
          }
          
          const commentRef = doc(db, `posts/${postDoc.id}/comments/${commentDoc.id}`);
          currentBatch.update(commentRef, {
            userDisplayName: displayName
          });
          
          operationCount++;
          updatedComments++;
        }
      }
    }
    
    // Add the last batch if it has operations
    if (operationCount > 0) {
      batchArray.push(currentBatch);
    }
    
    // Commit all batches
    console.log(`Committing ${batchArray.length} batches...`);
    for (const batch of batchArray) {
      await batch.commit();
    }
    
    console.log(`Migration completed successfully!`);
    console.log(`Total comments processed: ${totalComments}`);
    console.log(`Comments updated: ${updatedComments}`);
    
    return {
      success: true,
      totalComments,
      updatedComments
    };
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

module.exports = {
  updateExistingCommentsDisplayNames
}; 