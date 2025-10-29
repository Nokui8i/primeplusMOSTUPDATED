#!/usr/bin/env node

/**
 * Script to analyze database issues:
 * 1. Comments for non-existent posts
 * 2. Messages for non-existent chats
 * 3. Old chat structure
 * 4. Other orphaned data
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://primeplus-11a85-default-rtdb.firebaseio.com/"
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function analyzeIssues() {
  console.log('🔍 Analyzing database issues...\n');

  const issues = {
    orphanedComments: [],
    orphanedMessages: [],
    oldChatStructure: [],
    otherIssues: []
  };

  try {
    // 1. Check for comments with non-existent posts
    console.log('📝 Checking comments...');
    const commentsSnapshot = await db.collection('comments').get();
    console.log(`   Found ${commentsSnapshot.size} total comments`);
    
    const postIds = new Set();
    let orphanedCommentsCount = 0;
    
    for (const commentDoc of commentsSnapshot.docs) {
      const data = commentDoc.data();
      if (data.postId) {
        postIds.add(data.postId);
      }
    }
    
    console.log(`   Checking ${postIds.size} unique post IDs...`);
    let existingPosts = 0;
    for (const postId of postIds) {
      const postDoc = await db.collection('posts').doc(postId).get();
      if (postDoc.exists) {
        existingPosts++;
      } else {
        // Find comments for this non-existent post
        const orphanedComments = commentsSnapshot.docs.filter(
          doc => doc.data().postId === postId
        );
        issues.orphanedComments.push({
          postId,
          commentCount: orphanedComments.length,
          commentIds: orphanedComments.map(doc => doc.id)
        });
        orphanedCommentsCount += orphanedComments.length;
      }
    }
    
    console.log(`   ✅ Found ${existingPosts} existing posts`);
    console.log(`   ❌ Found ${orphanedCommentsCount} orphaned comments\n`);

    // 2. Check for messages in old chat structure
    console.log('💬 Checking old chat structure...');
    const oldChatsSnapshot = await db.collection('chats').get();
    console.log(`   Found ${oldChatsSnapshot.size} old chat documents`);
    
    let oldChatsWithMessages = 0;
    let totalOldMessages = 0;
    
    for (const chatDoc of oldChatsSnapshot.docs) {
      const messagesRef = chatDoc.ref.collection('messages');
      const messagesSnapshot = await messagesRef.get();
      
      if (messagesSnapshot.size > 0) {
        oldChatsWithMessages++;
        totalOldMessages += messagesSnapshot.size;
        
        // Check if there's a corresponding personal chat entry
        const chatData = chatDoc.data();
        if (chatData.participants && chatData.participants.length === 2) {
          const [userId1, userId2] = chatData.participants;
          const userChatId1 = `${userId1}_${userId2}`;
          const userChatId2 = `${userId2}_${userId1}`;
          
          const user1ChatRef = db.collection('users').doc(userId1).collection('chats').doc(userChatId1);
          const user2ChatRef = db.collection('users').doc(userId2).collection('chats').doc(userChatId2);
          
          const user1ChatExists = (await user1ChatRef.get()).exists;
          const user2ChatExists = (await user2ChatRef.get()).exists;
          
          if (!user1ChatExists || !user2ChatExists) {
            issues.oldChatStructure.push({
              chatId: chatDoc.id,
              participants: chatData.participants,
              messageCount: messagesSnapshot.size,
              hasPersonalChat1: user1ChatExists,
              hasPersonalChat2: user2ChatExists
            });
          }
        }
      }
    }
    
    console.log(`   ✅ Found ${oldChatsWithMessages} old chats with messages`);
    console.log(`   ❌ Found ${issues.oldChatStructure.length} orphaned old chats\n`);

    // 3. Check for messages in personal chats with non-existent sharedChatId
    console.log('💬 Checking personal chats...');
    const usersSnapshot = await db.collection('users').limit(100).get(); // Limit for performance
    console.log(`   Checking ${usersSnapshot.size} users...`);
    
    let orphanedPersonalChats = 0;
    let totalPersonalChats = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userChatsRef = userDoc.ref.collection('chats');
      const userChatsSnapshot = await userChatsRef.get();
      totalPersonalChats += userChatsSnapshot.size;
      
      for (const userChatDoc of userChatsSnapshot.docs) {
        const userChatData = userChatDoc.data();
        if (userChatData.sharedChatId) {
          const sharedChatRef = db.collection('chats').doc(userChatData.sharedChatId);
          const sharedChatExists = (await sharedChatRef.get()).exists;
          
          if (!sharedChatExists) {
            orphanedPersonalChats++;
            issues.orphanedMessages.push({
              userId: userDoc.id,
              userChatId: userChatDoc.id,
              sharedChatId: userChatData.sharedChatId,
              otherUserId: userChatData.otherUserId
            });
          }
        }
      }
    }
    
    console.log(`   ✅ Found ${totalPersonalChats} personal chats`);
    console.log(`   ❌ Found ${orphanedPersonalChats} orphaned personal chats\n`);

    // 4. Summary
    console.log('📊 Summary of Issues:');
    console.log('='.repeat(50));
    console.log(`❌ Orphaned Comments: ${orphanedCommentsCount}`);
    console.log(`❌ Orphaned Old Chats: ${issues.oldChatStructure.length}`);
    console.log(`❌ Orphaned Personal Chats: ${orphanedPersonalChats}`);
    console.log(`📝 Old Messages (that could be migrated/cleaned): ${totalOldMessages}`);
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        orphanedComments: orphanedCommentsCount,
        orphanedOldChats: issues.oldChatStructure.length,
        orphanedPersonalChats: orphanedPersonalChats,
        totalOldMessages: totalOldMessages
      },
      details: issues
    };
    
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, 'database-issues-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    return report;
    
  } catch (error) {
    console.error('💥 Analysis failed:', error);
    throw error;
  }
}

// Run analysis
analyzeIssues()
  .then(() => {
    console.log('\n✅ Analysis completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Analysis failed:', error);
    process.exit(1);
  });
