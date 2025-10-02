'use client';

/**
 * 🔒 PROTECTED CONTEXT - Authentication System
 * 
 * This context is critical for user authentication and session management. Modifications require:
 * 1. Explicit approval from the project maintainer
 * 2. Security review
 * 3. Testing of all auth flows
 * 4. Documentation updates in CHANGELOG.md
 * 
 * Protected Features:
 * - User authentication
 * - Session management
 * - Protected routes
 * - User state management
 * 
 * Last Modified: 2024-04-08
 * Version: stable-v1.0
 */

import { createContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, createUserDocument } from '@/lib/firebase';
import { messaging } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { getDatabase, ref as rtdbRef, onDisconnect, set as rtdbSet, onValue, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { doc as firestoreDoc, serverTimestamp as fsServerTimestamp } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: any) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

async function registerFcmToken(user: User) {
  if (typeof window === 'undefined' || !messaging) return;
  try {
    // Register the service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    // Get FCM token
    const fcmToken = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (fcmToken) {
      // Save token to Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          fcmToken,
          fcmTokenUpdatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, {
          fcmToken,
          fcmTokenUpdatedAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    console.error('Error registering FCM token:', err);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        // Register FCM token after login
        registerFcmToken(user);
        // --- Realtime Database Presence ---
        const rtdb = getDatabase();
        const userStatusDatabaseRef = rtdbRef(rtdb, '/status/' + user.uid);

        // Values for RTDB
        const isOfflineForDatabase = {
          state: 'offline',
          lastChanged: rtdbServerTimestamp(),
        };
        const isOnlineForDatabase = {
          state: 'online',
          lastChanged: rtdbServerTimestamp(),
        };

        // Values for Firestore
        const userStatusFirestoreRef = doc(db, 'users', user.uid);
        const isOfflineForFirestore = {
          online: false,
          lastSeen: serverTimestamp(),
        };
        const isOnlineForFirestore = {
          online: true,
          lastSeen: serverTimestamp(),
        };

        // Presence for /presence/{userId} (for UserAvatar)
        const presenceRef = firestoreDoc(db, 'presence', user.uid);
        const isOfflineForPresence = {
          status: 'offline',
          lastSeen: serverTimestamp(),
        };
        const isOnlineForPresence = {
          status: 'online',
          lastSeen: serverTimestamp(),
        };

        // Listen for connection state
        const connectedRef = rtdbRef(rtdb, '.info/connected');
        const rtdbUnsub = onValue(connectedRef, (snap) => {
          if (snap.val() === false) {
            // Not connected
            getDoc(userStatusFirestoreRef).then(userSnap => {
              if (userSnap.exists()) {
                updateDoc(userStatusFirestoreRef, isOfflineForFirestore);
              } else {
                setDoc(userStatusFirestoreRef, isOfflineForFirestore);
              }
            });
            setDoc(presenceRef, isOfflineForPresence, { merge: true });
            return;
          }

          // On disconnect, set to offline in RTDB and Firestore
          onDisconnect(userStatusDatabaseRef)
            .set(isOfflineForDatabase)
            .then(() => {
              // Set online in RTDB and Firestore
              rtdbSet(userStatusDatabaseRef, isOnlineForDatabase);
              getDoc(userStatusFirestoreRef).then(userSnap => {
                if (userSnap.exists()) {
                  updateDoc(userStatusFirestoreRef, isOnlineForFirestore);
                } else {
                  setDoc(userStatusFirestoreRef, isOnlineForFirestore);
                }
              });
              setDoc(presenceRef, isOnlineForPresence, { merge: true });
            });
        });

        // Clean up RTDB listener on unmount
        return () => rtdbUnsub();
      }
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, userData: any) => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      // Do not call createUserDocument here. The Cloud Function will create the user document.
      // If you need to update user fields, use updateDoc(doc(db, 'users', user.uid), { ... }) instead.
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  const logout = async () => {
    console.log('Logout called');
    let signOutError = null;
    try {
      if (user) {
        try {
          const rtdb = getDatabase();
          const userStatusDatabaseRef = rtdbRef(rtdb, '/status/' + user.uid);
          await rtdbSet(userStatusDatabaseRef, {
            state: 'offline',
            lastChanged: Date.now(),
          });
          console.log('RTDB presence set offline');
        } catch (err) {
          console.error('RTDB presence update failed:', err);
        }
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            await updateDoc(userRef, {
              online: false,
              lastSeen: serverTimestamp(),
            });
          } else {
            await setDoc(userRef, {
              online: false,
              lastSeen: serverTimestamp(),
            });
          }
          console.log('Firestore presence set offline');
          // Also update /presence/{userId}
          const presenceRef = firestoreDoc(db, 'presence', user.uid);
          await setDoc(presenceRef, { status: 'offline', lastSeen: fsServerTimestamp() }, { merge: true });
          console.log('Presence doc set offline');
        } catch (err) {
          console.error('Firestore presence update failed:', err);
        }
      }
      console.log('Calling signOut');
      await signOut(auth);
      console.log('Sign out complete');
    } catch (error) {
      console.error('Error signing out:', error);
      signOutError = error;
    }
    if (signOutError) throw signOutError;
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    logout,
    signOut: logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 