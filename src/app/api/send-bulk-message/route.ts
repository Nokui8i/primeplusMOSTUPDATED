import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
// import serviceAccount from '@/../primeplus-11a85-firebase-adminsdk-fbsvc-807c9cabc2.json';

export const runtime = 'nodejs';

if (!getApps().length) {
  initializeApp({
    // credential: cert(serviceAccount as any),
    storageBucket: 'primeplus-11a85.firebasestorage.app',
    projectId: 'primeplus-11a85',
    databaseURL: 'https://primeplus-11a85-default-rtdb.firebaseio.com'
  });
}

const db = getFirestore();
const storage = getStorage();

export async function POST(req: NextRequest) {
  try {
    const { to, text, type, images, videos, audio, locked } = await req.json();
    // Authenticate the sender
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    let senderId = '';
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      senderId = decoded.uid;
    } catch (err) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    if (!to || !text) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    // Find or create chat between sender and recipient
    const chatParticipants = [senderId, to].sort();
    const chatId = chatParticipants.join('_');
    const chatsRef = db.collection('chats');
    const chatRef = chatsRef.doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
      await chatRef.set({
        participants: chatParticipants,
        createdAt: Timestamp.now(),
        lastMessage: text,
        lastMessageTime: Timestamp.now(),
        lastMessageSender: senderId,
      });
    }
    // Upload attachments if any
    let attachments = [];
    if (images && images.length > 0) {
      for (const imageObj of images) {
        const { base64, locked, price } = imageObj;
        const imageBuffer = Buffer.from(base64.split(',')[1], 'base64');
        const imageRef = storage.bucket().file(`chats/${chatId}/images/${Date.now()}.jpg`);
        await imageRef.save(imageBuffer, { contentType: 'image/jpeg' });
        const url = await imageRef.getSignedUrl({ action: 'read', expires: '03-01-2500' });
        attachments.push({ 
          type: 'image', 
          url: url[0], 
          locked: !!locked, 
          ...(locked && price ? { price } : {}), 
          unlockedBy: locked ? [] : undefined 
        });
      }
    }
    if (videos && videos.length > 0) {
      for (const videoObj of videos) {
        const { base64, locked, price } = videoObj;
        const videoBuffer = Buffer.from(base64.split(',')[1], 'base64');
        const videoRef = storage.bucket().file(`chats/${chatId}/videos/${Date.now()}.mp4`);
        await videoRef.save(videoBuffer, { contentType: 'video/mp4' });
        const url = await videoRef.getSignedUrl({ action: 'read', expires: '03-01-2500' });
        attachments.push({ 
          type: 'video', 
          url: url[0], 
          locked: !!locked, 
          ...(locked && price ? { price } : {}), 
          unlockedBy: locked ? [] : undefined 
        });
      }
    }
    if (audio && audio.length > 0) {
      for (const audioFile of audio) {
        const audioBuffer = Buffer.from(audioFile.split(',')[1], 'base64');
        const audioRef = storage.bucket().file(`chats/${chatId}/audio/${Date.now()}.mp3`);
        await audioRef.save(audioBuffer, { contentType: 'audio/mpeg' });
        const url = await audioRef.getSignedUrl({ action: 'read', expires: '03-01-2500' });
        attachments.push({ type: 'audio', url: url[0] });
      }
    }
    // Add message to chat
    const messagesRef = db.collection('chats').doc(chatId).collection('messages');
    await messagesRef.add({
      text,
      senderId,
      timestamp: Timestamp.now(),
      read: false,
      type: type || 'text',
      attachments,
      status: 'sent',
      ...(locked !== undefined ? { locked } : {})
    });
    // Update chat last message
    await db.collection('chats').doc(chatId).update({
      lastMessage: text,
      lastMessageTime: Timestamp.now(),
      lastMessageSender: senderId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bulk message error:', error);
    let errorMsg = 'Internal Server Error';
    if (error instanceof Error) errorMsg = error.message;
    else if (typeof error === 'string') errorMsg = error;
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
} 