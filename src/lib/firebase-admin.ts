// Conditional imports to avoid Edge Runtime issues
let auth: any = null;
let db: any = null;
let messaging: any = null;

// Only initialize on server side
if (typeof window === 'undefined') {
  try {
    const { initializeApp, getApps, cert } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    const { getFirestore } = require('firebase-admin/firestore');
    const { getMessaging } = require('firebase-admin/messaging');

    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    auth = getAuth();
    db = getFirestore();
    messaging = getMessaging();
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

// Export functions that return the initialized instances
export const getAuth = () => auth;
export const getFirestore = () => db;
export const getMessaging = () => messaging;

// Also export the instances directly for backward compatibility
export { auth, db, messaging }; 