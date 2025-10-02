import { getFirestore } from 'firebase/firestore';
import { app } from '../config';

export function useFirestore() {
  const db = getFirestore(app);
  return db;
} 