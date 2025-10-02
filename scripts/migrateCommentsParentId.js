const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where } = require('firebase/firestore');

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateCommentsParentId() {
  console.log('🔄 Starting migration of comments parentId field...');
  
  try {
    // Get all posts
    const postsSnapshot = await getDocs(collection(db, 'posts'));
    console.log(`📝 Found ${postsSnapshot.docs.length} posts to check`);
    
    let totalCommentsProcessed = 0;
    let totalCommentsUpdated = 0;
    
    for (const postDoc of postsSnapshot.docs) {
      const postId = postDoc.id;
      console.log(`\n🔍 Checking post: ${postId}`);
      
      // Get all comments for this post
      const commentsSnapshot = await getDocs(collection(db, `posts/${postId}/comments`));
      console.log(`  📄 Found ${commentsSnapshot.docs.length} comments`);
      
      for (const commentDoc of commentsSnapshot.docs) {
        const commentId = commentDoc.id;
        const commentData = commentDoc.data();
        totalCommentsProcessed++;
        
        // Check if comment has parentCommentId but no parentId
        if (commentData.parentCommentId !== undefined && commentData.parentId === undefined) {
          console.log(`  🔧 Updating comment ${commentId}: parentCommentId=${commentData.parentCommentId} -> parentId=${commentData.parentCommentId}`);
          
          // Update the comment to add parentId field
          await updateDoc(doc(db, `posts/${postId}/comments/${commentId}`), {
            parentId: commentData.parentCommentId
          });
          
          totalCommentsUpdated++;
        } else if (commentData.parentCommentId === undefined && commentData.parentId === undefined) {
          // This is a top-level comment, ensure parentId is null
          console.log(`  🔧 Updating comment ${commentId}: adding parentId=null for top-level comment`);
          
          await updateDoc(doc(db, `posts/${postId}/comments/${commentId}`), {
            parentId: null
          });
          
          totalCommentsUpdated++;
        } else {
          console.log(`  ✅ Comment ${commentId} already has correct parentId field`);
        }
      }
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`📊 Total comments processed: ${totalCommentsProcessed}`);
    console.log(`🔧 Total comments updated: ${totalCommentsUpdated}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateCommentsParentId()
  .then(() => {
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });

