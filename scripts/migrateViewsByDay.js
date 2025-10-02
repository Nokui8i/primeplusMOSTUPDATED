const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK with service account key
const serviceAccountPath = path.join(__dirname, '../primeplus-11a85-firebase-adminsdk-fbsvc-807c9cabc2.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath)
});

const db = admin.firestore();

async function migrateViewsByDay() {
  const postsSnap = await db.collection('posts').get();
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dayKey = `${yyyy}-${mm}-${dd}`;
  let updated = 0;

  for (const doc of postsSnap.docs) {
    const data = doc.data();
    const engagement = data.engagement || {};
    if (
      typeof engagement.views === 'number' &&
      (!engagement.viewsByDay || Object.keys(engagement.viewsByDay).length === 0)
    ) {
      await doc.ref.update({
        'engagement.viewsByDay': { [dayKey]: engagement.views }
      });
      updated++;
      console.log(`Migrated post ${doc.id}: set viewsByDay to { ${dayKey}: ${engagement.views} }`);
    }
  }
  console.log(`Migration complete. Updated ${updated} posts.`);
}

migrateViewsByDay().catch(console.error); 