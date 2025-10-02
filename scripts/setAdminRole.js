const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK with service account key
const serviceAccountPath = path.join(__dirname, '../primeplus-11a85-firebase-adminsdk-fbsvc-807c9cabc2.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath)
});

const db = admin.firestore();

async function setAdminRole(uid) {
  const userRef = db.collection('users').doc(uid);
  try {
    await userRef.update({ role: 'admin' });
    console.log(`User ${uid} successfully set as admin.`);
  } catch (error) {
    console.error(`Error setting user ${uid} as admin:`, error);
  }
}

// Replace 'ojKhs5rVVtYsumeG7FNL28p1Re33' with your actual user ID if needed
setAdminRole('ojKhs5rVVtYsumeG7FNL28p1Re33').catch(console.error); 