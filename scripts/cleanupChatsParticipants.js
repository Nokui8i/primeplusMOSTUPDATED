const admin = require('firebase-admin');
const path = require('path');

// Path to your Firebase service account key
const serviceAccount = require(path.resolve(__dirname, '../primeplus-11a85-firebase-adminsdk-fbsvc-807c9cabc2.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function cleanupChats() {
  const usersSnapshot = await db.collection('users').get();
  const validUIDs = new Set(usersSnapshot.docs.map(doc => doc.id));

  const chatsSnapshot = await db.collection('chats').get();
  for (const chatDoc of chatsSnapshot.docs) {
    const chatData = chatDoc.data();
    const originalParticipants = chatData.participants || [];
    // Only keep participants that are real UIDs (in users collection, no underscores)
    const cleanedParticipants = originalParticipants.filter(
      id => typeof id === 'string' && !id.includes('_') && validUIDs.has(id)
    );
    if (cleanedParticipants.length === 0) {
      // Optionally, delete the chat if no valid participants remain
      await chatDoc.ref.delete();
      console.log(`Deleted chat ${chatDoc.id} (no valid participants)`);
    } else if (cleanedParticipants.length !== originalParticipants.length) {
      await chatDoc.ref.update({ participants: cleanedParticipants });
      console.log(`Updated chat ${chatDoc.id}:`, cleanedParticipants);
    }
  }
  console.log('Cleanup complete!');
}

cleanupChats().catch(console.error); 