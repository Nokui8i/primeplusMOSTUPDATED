import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const runtime = 'nodejs'; // Ensure Node.js runtime

// Initialize Firebase Admin helper function
function initFirebaseAdmin() {
  // First, try to use existing Firebase Admin instance from firebase-admin.ts
  try {
    const { getFirestore: getFirestoreFromLib } = require('@/lib/firebase-admin');
    const existingDb = getFirestoreFromLib();
    if (existingDb) {
      console.log('✅ Using existing Firebase Admin from firebase-admin.ts');
      return existingDb;
    }
  } catch (err: any) {
    console.log('⚠️ Could not use firebase-admin.ts, error:', err.message);
  }
  
  // Also check if there's already an initialized app
  try {
    if (getApps().length > 0) {
      const db = getFirestore();
      if (db) {
        console.log('✅ Using existing Firebase Admin instance');
        return db;
      }
    }
  } catch (err: any) {
    console.log('⚠️ No existing Firebase Admin instance');
  }

  if (!getApps().length) {
    try {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey) {
        console.error('Missing Firebase Admin credentials:', {
          hasProjectId: !!projectId,
          hasClientEmail: !!clientEmail,
          hasPrivateKey: !!privateKey
        });
        return null;
      }

      // Clean up private key format
      privateKey = privateKey.trim();
      
      // Remove surrounding quotes if present (handle both single and double quotes)
      while ((privateKey.startsWith('"') && privateKey.endsWith('"')) || 
             (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1).trim();
      }
      
      // Replace escaped newlines with actual newlines
      // Handle both single escape (\n) and double escape (\\n)
      privateKey = privateKey.replace(/\\\\n/g, '\n'); // Double escape first
      privateKey = privateKey.replace(/\\n/g, '\n');  // Then single escape
      
      // Remove any trailing newlines/spaces after END
      privateKey = privateKey.replace(/\s+$/, '');
      
      // Ensure END is on its own line (no trailing newline after END)
      privateKey = privateKey.replace(/-----END PRIVATE KEY-----\s*$/, '-----END PRIVATE KEY-----');
      
      // Validate key structure before using it
      if (!privateKey.startsWith('-----BEGIN')) {
        console.error('Private key does not start with BEGIN');
        return null;
      }
      
      if (!privateKey.includes('-----END PRIVATE KEY-----')) {
        console.error('Private key does not contain END marker');
        return null;
      }
      
      // Extract the actual key content (between BEGIN and END)
      const beginIndex = privateKey.indexOf('-----BEGIN PRIVATE KEY-----') + '-----BEGIN PRIVATE KEY-----'.length;
      const endIndex = privateKey.indexOf('-----END PRIVATE KEY-----');
      const keyContent = privateKey.substring(beginIndex, endIndex).trim();
      
      // Remove all newlines and whitespace from key content, then validate it's not empty
      const cleanKeyContent = keyContent.replace(/\s+/g, '');
      if (cleanKeyContent.length < 100) {
        console.error('Private key content seems too short:', cleanKeyContent.length);
        return null;
      }
      
      // Log key structure for debugging
      console.log('Private key structure:', {
        totalLength: privateKey.length,
        keyContentLength: cleanKeyContent.length,
        lineCount: cleanedLines.length,
        firstLine: cleanedLines[0]?.substring(0, 50),
        lastLine: cleanedLines[cleanedLines.length - 1]?.substring(0, 50),
        hasBegin: privateKey.includes('BEGIN'),
        hasEnd: privateKey.includes('END'),
        keyContentPreview: cleanKeyContent.substring(0, 30) + '...'
      });

      try {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://primeplus-11a85-default-rtdb.firebaseio.com/'
        });
      } catch (initError: any) {
        // If initialization fails, try without databaseURL
        console.warn('Initialization with databaseURL failed, trying without...');
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          })
        });
      }
      
      return getFirestore();
    } catch (error: any) {
      console.error('Failed to initialize Firebase Admin in API route:', error.message);
      console.error('Error details:', error.errorInfo);
      
      // Log private key info (first 50 chars only for security)
      const privateKeyPreview = process.env.FIREBASE_PRIVATE_KEY?.substring(0, 50) || 'undefined';
      console.error('Private key preview:', privateKeyPreview + '...');
      console.error('Private key starts with BEGIN?', privateKeyPreview.includes('BEGIN'));
      
      return null;
    }
  }
  
  try {
    return getFirestore();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Initialize and get Firestore instance
    const db = initFirebaseAdmin();
    
    // Check if db is initialized
    if (!db) {
      console.error('Firebase Admin db is not initialized');
      const hasProjectId = !!(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
      const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
      const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;
      const privateKeyLength = process.env.FIREBASE_PRIVATE_KEY?.length || 0;
      
      return NextResponse.json({ 
        success: false, 
        error: 'Firebase Admin is not initialized.',
        details: {
          missing: {
            projectId: !hasProjectId,
            clientEmail: !hasClientEmail,
            privateKey: !hasPrivateKey
          },
          privateKeyLength: privateKeyLength,
          hint: 'The FIREBASE_PRIVATE_KEY must be the full private key from Firebase Service Account JSON, including BEGIN and END lines, with \\n for line breaks. Example: "-----BEGIN PRIVATE KEY-----\\n[content]\\n-----END PRIVATE KEY-----"'
        }
      }, { status: 500 });
    }

    const { action } = await request.json();

    if (action === 'analyze') {
      // Analyze issues
      const issues = {
        orphanedComments: [] as any[],
        orphanedMessages: [] as any[],
        oldChatStructure: [] as any[],
        stats: {
          totalComments: 0,
          totalOldChats: 0,
          totalPersonalChats: 0,
          orphanedCommentsCount: 0,
          orphanedPersonalChatsCount: 0
        }
      };

      // 1. Check comments for non-existent posts
      const commentsSnapshot = await db.collection('comments').limit(100).get();
      issues.stats.totalComments = commentsSnapshot.size;
      
      const postIds = new Set<string>();
      commentsSnapshot.docs.forEach(doc => {
        const postId = doc.data().postId;
        if (postId) postIds.add(postId);
      });

      let orphanedCommentsCount = 0;
      for (const postId of postIds) {
        const postDoc = await db.collection('posts').doc(postId).get();
        if (!postDoc.exists) {
          const orphanedComments = commentsSnapshot.docs.filter(
            doc => doc.data().postId === postId
          );
          orphanedCommentsCount += orphanedComments.length;
          issues.orphanedComments.push({
            postId,
            commentCount: orphanedComments.length
          });
        }
      }
      issues.stats.orphanedCommentsCount = orphanedCommentsCount;

      // 2. Check old chat structure
      const oldChatsSnapshot = await db.collection('chats').limit(50).get();
      issues.stats.totalOldChats = oldChatsSnapshot.size;

      // 3. Check personal chats
      const usersSnapshot = await db.collection('users').limit(20).get();
      let totalPersonalChats = 0;
      let orphanedPersonalChatsCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userChatsSnapshot = await userDoc.ref.collection('chats').get();
        totalPersonalChats += userChatsSnapshot.size;

        for (const userChatDoc of userChatsSnapshot.docs) {
          const userChatData = userChatDoc.data();
          if (userChatData.sharedChatId) {
            const sharedChatRef = db.collection('chats').doc(userChatData.sharedChatId);
            const sharedChatExists = (await sharedChatRef.get()).exists;
            
            if (!sharedChatExists) {
              orphanedPersonalChatsCount++;
              issues.orphanedMessages.push({
                userId: userDoc.id,
                sharedChatId: userChatData.sharedChatId
              });
            }
          }
        }
      }
      
      issues.stats.totalPersonalChats = totalPersonalChats;
      issues.stats.orphanedPersonalChatsCount = orphanedPersonalChatsCount;

      return NextResponse.json({ success: true, issues });
    }

    if (action === 'cleanup-comments') {
      // Clean up orphaned comments
      const commentsSnapshot = await db.collection('comments').limit(500).get();
      const batch = db.batch();
      let deletedCount = 0;

      for (const commentDoc of commentsSnapshot.docs) {
        const postId = commentDoc.data().postId;
        if (postId) {
          const postDoc = await db.collection('posts').doc(postId).get();
          if (!postDoc.exists) {
            batch.delete(commentDoc.ref);
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        await batch.commit();
      }

      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${deletedCount} orphaned comments` 
      });
    }

    if (action === 'cleanup-personal-chats') {
      // Clean up orphaned personal chats
      const usersSnapshot = await db.collection('users').limit(100).get();
      const batch = db.batch();
      let deletedCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userChatsSnapshot = await userDoc.ref.collection('chats').get();
        
        for (const userChatDoc of userChatsSnapshot.docs) {
          const userChatData = userChatDoc.data();
          if (userChatData.sharedChatId) {
            const sharedChatRef = db.collection('chats').doc(userChatData.sharedChatId);
            const sharedChatExists = (await sharedChatRef.get()).exists;
            
            if (!sharedChatExists) {
              batch.delete(userChatDoc.ref);
              deletedCount++;
            }
          }
        }
      }

      if (deletedCount > 0) {
        await batch.commit();
      }

      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${deletedCount} orphaned personal chats` 
      });
    }

    if (action === 'cleanup-all') {
      // Clean up everything
      let totalDeleted = 0;

      // 1. Clean comments
      const commentsSnapshot = await db.collection('comments').limit(500).get();
      const batch1 = db.batch();
      let deletedComments = 0;

      for (const commentDoc of commentsSnapshot.docs) {
        const postId = commentDoc.data().postId;
        if (postId) {
          const postDoc = await db.collection('posts').doc(postId).get();
          if (!postDoc.exists) {
            batch1.delete(commentDoc.ref);
            deletedComments++;
          }
        }
      }

      if (deletedComments > 0) {
        await batch1.commit();
      }
      totalDeleted += deletedComments;

      // 2. Clean personal chats
      const usersSnapshot = await db.collection('users').limit(100).get();
      const batch2 = db.batch();
      let deletedChats = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userChatsSnapshot = await userDoc.ref.collection('chats').get();
        
        for (const userChatDoc of userChatsSnapshot.docs) {
          const userChatData = userChatDoc.data();
          if (userChatData.sharedChatId) {
            const sharedChatRef = db.collection('chats').doc(userChatData.sharedChatId);
            const sharedChatExists = (await sharedChatRef.get()).exists;
            
            if (!sharedChatExists) {
              batch2.delete(userChatDoc.ref);
              deletedChats++;
            }
          }
        }
      }

      if (deletedChats > 0) {
        await batch2.commit();
      }
      totalDeleted += deletedChats;

      return NextResponse.json({ 
        success: true, 
        message: `Cleanup completed! Deleted ${totalDeleted} items (${deletedComments} comments, ${deletedChats} chats)` 
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Cleanup error:', error);
    console.error('Error stack:', error.stack);
    console.error('Environment check:', {
      hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
