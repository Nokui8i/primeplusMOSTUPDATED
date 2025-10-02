import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

// Helper to verify Firebase ID token from Authorization header
async function verifyIdToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  const idToken = authHeader.replace('Bearer ', '');
  const decoded = await getAuth().verifyIdToken(idToken);
  return decoded.uid;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const uid = await verifyIdToken(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getFirestore();

    // 2. Look up username before deleting user document
    const userDoc = await db.collection('users').doc(uid).get();
    let username = null;
    if (userDoc.exists) {
      username = userDoc.data()?.username;
    }

    // 3. Delete user document
    await db.collection('users').doc(uid).delete();

    // 4. Delete username document if username exists
    if (username) {
      await db.collection('usernames').doc(username).delete();
    }

    // 5. Delete all posts authored by the user
    const postsSnap = await db.collection('posts').where('authorId', '==', uid).get();
    const postBatch = db.batch();
    postsSnap.forEach((doc: any) => postBatch.delete(doc.ref));
    await postBatch.commit();

    // 6. Delete all subscriptions where the user is the subscriber
    const subsSnap = await db.collection('subscriptions').where('subscriberId', '==', uid).get();
    const subBatch = db.batch();
    subsSnap.forEach((doc: any) => subBatch.delete(doc.ref));
    await subBatch.commit();

    // 7. Call backend cleanup Cloud Function for storage cleanup
    const cleanupUrl = process.env.CLEANUP_USER_DELETE_URL; // e.g., https://us-central1-yourproject.cloudfunctions.net/cleanupStorageOnUserDelete
    if (!cleanupUrl) {
      throw new Error('Cleanup function URL not configured');
    }
    const cleanupRes = await fetch(cleanupUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid }),
    });
    if (!cleanupRes.ok) {
      const text = await cleanupRes.text();
      console.error('Cleanup function error response:', text);
      throw new Error('Failed to cleanup user storage: ' + text);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete account error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete account', details: error.stack }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
} 