import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Function to create a test user for development
export async function createTestUser() {
  try {
    const testUserId = 'testuser123';
    const testUsername = 'testuser';
    
    // Create user document
    await setDoc(doc(db, 'users', testUserId), {
      username: testUsername,
      displayName: 'Test User',
      email: 'test@example.com',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      bio: 'This is a test user for development',
      role: 'user'
    });

    // Create username document for uniqueness
    await setDoc(doc(db, 'usernames', testUsername), {
      uid: testUserId
    });

    console.log('Test user created successfully');
  } catch (error) {
    console.error('Error creating test user:', error);
  }
}

export { app, auth, db, storage, analytics }; 