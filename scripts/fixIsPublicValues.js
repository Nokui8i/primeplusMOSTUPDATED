const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

async function fixIsPublicValues() {
  console.log('🔧 Starting to fix isPublic values...');
  
  try {
    // Get all posts
    const postsSnapshot = await db.collection('posts').get();
    console.log(`📄 Found ${postsSnapshot.docs.length} posts to process`);
    
    const batch = db.batch();
    let updateCount = 0;
    
    for (const doc of postsSnapshot.docs) {
      const data = doc.data();
      const postId = doc.id;
      
      console.log(`\n📝 Processing post ${postId}:`);
      console.log(`   Current isPublic: ${data.isPublic}`);
      console.log(`   accessSettings:`, data.accessSettings);
      
      // Determine the correct isPublic value based on accessSettings
      let shouldBePublic = true; // Default to public
      
      if (data.accessSettings) {
        const accessLevel = data.accessSettings.accessLevel;
        
        // If access level is explicitly set to something other than 'free', make it private
        if (accessLevel && accessLevel !== 'free') {
          shouldBePublic = false;
          console.log(`   → Setting to PRIVATE (accessLevel: ${accessLevel})`);
        } else {
          console.log(`   → Setting to PUBLIC (accessLevel: ${accessLevel || 'undefined'})`);
        }
      } else {
        console.log(`   → Setting to PUBLIC (no accessSettings)`);
      }
      
      // Only update if the value needs to change
      if (data.isPublic !== shouldBePublic) {
        batch.update(doc.ref, { isPublic: shouldBePublic });
        updateCount++;
        console.log(`   ✅ Will update isPublic from ${data.isPublic} to ${shouldBePublic}`);
      } else {
        console.log(`   ⏭️  No change needed (already ${shouldBePublic})`);
      }
    }
    
    if (updateCount > 0) {
      console.log(`\n💾 Committing ${updateCount} updates...`);
      await batch.commit();
      console.log(`✅ Successfully updated ${updateCount} posts!`);
    } else {
      console.log(`\n✅ No updates needed - all posts already have correct isPublic values!`);
    }
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    process.exit(0);
  }
}

// Run the migration
fixIsPublicValues();
