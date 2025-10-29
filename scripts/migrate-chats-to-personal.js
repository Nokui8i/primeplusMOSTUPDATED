#!/usr/bin/env node

/**
 * Migration script to convert existing shared chats to personal chat system
 * This script will:
 * 1. Read all existing chats from the 'chats' collection
 * 2. Create personal chat entries for each user in 'users/{userId}/chats'
 * 3. Preserve all existing messages
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const admin = require('firebase-admin');

// Initialize Firebase Admin with credentials from .env
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

async function migrateChats() {
  console.log('🚀 Starting chat migration...');
  
  try {
    // Get all existing chats
    const chatsSnapshot = await db.collection('chats').get();
    console.log(`📊 Found ${chatsSnapshot.size} existing chats to migrate`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const chatDoc of chatsSnapshot.docs) {
      try {
        const chatData = chatDoc.data();
        const participants = chatData.participants || [];
        
        if (participants.length !== 2) {
          console.log(`⚠️ Skipping chat ${chatDoc.id} - not a 2-person chat`);
          continue;
        }
        
        const [user1Id, user2Id] = participants;
        const sharedChatId = chatDoc.id;
        
        // Create personal chat entries for both users
        const user1ChatId = `${user1Id}_${user2Id}`;
        const user2ChatId = `${user2Id}_${user1Id}`;
        
        const user1ChatData = {
          otherUserId: user2Id,
          sharedChatId: sharedChatId,
          lastMessage: chatData.lastMessage || '',
          lastMessageTime: chatData.lastMessageTime || admin.firestore.FieldValue.serverTimestamp(),
          unreadCount: chatData.unreadCounts?.[user1Id] || 0,
          pinned: chatData.pinnedBy?.[user1Id] || false,
          deletedByUser: chatData.deletedBy?.includes(user1Id) || false,
          createdAt: chatData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const user2ChatData = {
          otherUserId: user1Id,
          sharedChatId: sharedChatId,
          lastMessage: chatData.lastMessage || '',
          lastMessageTime: chatData.lastMessageTime || admin.firestore.FieldValue.serverTimestamp(),
          unreadCount: chatData.unreadCounts?.[user2Id] || 0,
          pinned: chatData.pinnedBy?.[user2Id] || false,
          deletedByUser: chatData.deletedBy?.includes(user2Id) || false,
          createdAt: chatData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // Write personal chat entries
        await db.collection('users').doc(user1Id).collection('chats').doc(user1ChatId).set(user1ChatData);
        await db.collection('users').doc(user2Id).collection('chats').doc(user2ChatId).set(user2ChatData);
        
        // Clean up the shared chat document (remove old fields)
        const cleanedChatData = {
          participants: participants,
          lastMessage: chatData.lastMessage || '',
          lastMessageTime: chatData.lastMessageTime || admin.firestore.FieldValue.serverTimestamp(),
          createdAt: chatData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('chats').doc(sharedChatId).set(cleanedChatData);
        
        migratedCount++;
        console.log(`✅ Migrated chat ${sharedChatId} (${user1Id} <-> ${user2Id})`);
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error migrating chat ${chatDoc.id}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Successfully migrated: ${migratedCount} chats`);
    console.log(`❌ Errors: ${errorCount} chats`);
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  }
}

// Run migration
migrateChats()
  .then(() => {
    console.log('🏁 Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
