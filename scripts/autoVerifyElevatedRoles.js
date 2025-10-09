/**
 * Auto-verify all users with elevated roles (admin, superadmin, owner)
 * These roles should automatically have verification status set to true
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

async function autoVerifyElevatedRoles() {
  console.log('🔍 Searching for users with elevated roles...\n');
  
  const elevatedRoles = ['admin', 'superadmin', 'owner'];
  const batch = db.batch();
  let updateCount = 0;
  let alreadyVerifiedCount = 0;
  
  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`📊 Total users in database: ${usersSnapshot.size}\n`);
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      const userRole = userData.role;
      
      // Check if user has elevated role
      if (elevatedRoles.includes(userRole)) {
        // Check if already verified
        if (userData.isVerified === true && userData.verificationStatus === 'verified') {
          console.log(`✓ ${userRole.toUpperCase()} already verified: ${userData.username || userData.email || userId}`);
          alreadyVerifiedCount++;
        } else {
          console.log(`🔧 Auto-verifying ${userRole.toUpperCase()}: ${userData.username || userData.email || userId}`);
          
          // Update user document
          batch.update(doc.ref, {
            isVerified: true,
            verificationStatus: 'verified',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          updateCount++;
        }
      }
    }
    
    // Commit all updates
    if (updateCount > 0) {
      await batch.commit();
      console.log(`\n✅ Successfully verified ${updateCount} elevated role account(s)`);
    } else {
      console.log(`\n✅ No updates needed - all elevated roles already verified`);
    }
    
    console.log(`📊 Summary:`);
    console.log(`   - Already verified: ${alreadyVerifiedCount}`);
    console.log(`   - Newly verified: ${updateCount}`);
    console.log(`   - Total elevated roles: ${alreadyVerifiedCount + updateCount}`);
    
  } catch (error) {
    console.error('❌ Error during verification process:', error);
    throw error;
  }
}

// Run the script
autoVerifyElevatedRoles()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

