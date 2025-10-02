import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { getAuth } from 'firebase/auth';

/**
 * Loads an image from Firebase Storage or returns the given URL.
 * For Firebase Storage URLs, just return as is (they are already valid download URLs).
 * For other URLs, return as is.
 */
export async function loadImage(src: string): Promise<string> {
  // If it's a Firebase Storage URL, just return it
  if (src.includes('firebasestorage.googleapis.com')) {
    return src;
  }
  // For regular URLs, return as is
  return src;
} 