#!/usr/bin/env node

/**
 * Script to clean up unreadCount from deleted chats
 * This ensures deleted chats don't show unread indicators
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://primeplus-11a85-default-rtdb.firebaseio.com/"
  });
}

const db = admin.firestore();

async function cleanupDeletedChats() {
  console.log('🚀 Starting cleanup of deleted chats unreadCount...');
  
  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Found ${usersSnapshot.size} users to check`);
    
    let cleanedCount = 0;
    let totalDeletedChats = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userChatsRef = db.collection('users').doc(userId).collection('chats');
      const userChatsSnapshot = await userChatsRef.get();
      
      const batch = db.batch();
      let hasUpdates = false;
      
      userChatsSnapshot.docs.forEach((chatDoc) => {
        const data = chatDoc.data();
        
        // If chat is deleted but has unreadCount > 0, reset it
        if (data.deletedByUser && (data.unreadCount || 0) > 0) {
          batch.update(chatDoc.ref, {
            unreadCount: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          hasUpdates = true;
          totalDeletedChats++;
        }
      });
      
      if (hasUpdates) {
        await batch.commit();
        cleanedCount++;
        console.log(`✅ Cleaned deleted chats for user ${userId}`);
      }
    }
    
    console.log(`\n🎉 Cleanup completed!`);
    console.log(`✅ Cleaned ${cleanedCount} users`);
    console.log(`🗑️ Reset unreadCount for ${totalDeletedChats} deleted chats`);
    
  } catch (error) {
    console.error('💥 Cleanup failed:', error);
  }
}

// Run cleanup
cleanupDeletedChats()
  .then(() => {
    console.log('🏁 Cleanup script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cleanup script failed:', error);
    process.exit(1);
  });
