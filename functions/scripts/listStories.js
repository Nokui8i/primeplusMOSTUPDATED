const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function listStories() {
  const snapshot = await db.collection('stories').get();
  snapshot.forEach(doc => {
    console.log('Doc ID:', doc.id, 'Field id:', doc.data().id);
  });
  process.exit(0);
}
listStories(); 