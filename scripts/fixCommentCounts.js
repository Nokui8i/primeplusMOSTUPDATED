const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

async function fixCommentCounts() {
  console.log('🔧 Starting to fix comment counts...');
  
  try {
    // Get all posts
    const postsSnapshot = await db.collection('posts').get();
    console.log(`📄 Found ${postsSnapshot.docs.length} posts to process`);
    
    const batch = db.batch();
    let updateCount = 0;
    
    for (const postDoc of postsSnapshot.docs) {
      const postId = postDoc.id;
      const postData = postDoc.data();
      
      console.log(`\n📝 Processing post ${postId}:`);
      console.log(`   Current comment count: ${postData.comments || 0}`);
      
      // Count actual comments for this post
      const commentsQuery = db.collection('comments').where('postId', '==', postId);
      const commentsSnapshot = await commentsQuery.get();
      const actualCommentCount = commentsSnapshot.docs.length;
      
      console.log(`   Actual comment count: ${actualCommentCount}`);
      
      // Only update if the count is different
      if ((postData.comments || 0) !== actualCommentCount) {
        batch.update(postDoc.ref, { comments: actualCommentCount });
        updateCount++;
        console.log(`   ✅ Will update comment count from ${postData.comments || 0} to ${actualCommentCount}`);
      } else {
        console.log(`   ⏭️  No change needed (already correct)`);
      }
    }
    
    if (updateCount > 0) {
      console.log(`\n💾 Committing ${updateCount} updates...`);
      await batch.commit();
      console.log(`✅ Successfully updated ${updateCount} posts!`);
    } else {
      console.log(`\n✅ No updates needed - all comment counts are correct!`);
    }
    
    console.log('\n🎉 Comment count fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during comment count fix:', error);
  } finally {
    process.exit(0);
  }
}

// Run the fix
fixCommentCounts();
