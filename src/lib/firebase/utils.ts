import { doc, getDoc } from 'firebase/firestore';
import { db } from './config';
import { User, createDefaultUser } from '@/lib/types/user';

export class AuthorNotFoundError extends Error {
  constructor(authorId: string) {
    super(`Author with ID ${authorId} not found`);
    this.name = 'AuthorNotFoundError';
  }
}

export async function fetchAuthorInfo(authorId: string): Promise<User> {
  if (!authorId.trim()) {
    throw new Error('Author ID is required');
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', authorId));
    if (!userDoc.exists()) {
      throw new AuthorNotFoundError(authorId);
    }

    const userData = userDoc.data();
    return createDefaultUser({
      uid: userDoc.id,
      displayName: userData.displayName,
      username: userData.username,
      photoURL: userData.photoURL,
      isVerified: userData.isVerified || false,
      ...userData
    });
  } catch (error) {
    if (error instanceof AuthorNotFoundError) {
      throw error;
    }
    console.error('Error fetching author info:', error);
    throw new Error('Failed to fetch author information');
  }
}

export function createPostWithAuthor(postData: any, author: User) {
  return {
    id: postData.id,
    content: postData.content,
    imageUrl: postData.imageUrl,
    likes: postData.likes || 0,
    comments: postData.comments || 0,
    createdAt: postData.createdAt,
    author: author
  };
} 