import { app, auth, db, storage, analytics } from './firebase/config';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Helper functions
export const createUserDocument = async (userId: string, data: any) => {
  try {
    await setDoc(doc(db, 'users', userId), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating user document:', error);
  }
};

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