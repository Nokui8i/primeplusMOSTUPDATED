import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

// Path to your service account key
const serviceAccountPath = 'c:/Users/iaaoa/Downloads/primeplus-11a85-firebase-adminsdk-fbsvc-807c9cabc2.json';
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

const userId = 'ojKhs5rVVtYsumeG7FNL28p1Re33';

db.collection('users').doc(userId).update({ role: 'owner' })
  .then(() => {
    console.log('User promoted to owner!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to promote user:', err);
    process.exit(1);
  }); 