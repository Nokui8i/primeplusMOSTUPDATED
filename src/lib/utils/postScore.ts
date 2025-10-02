import { Post } from '../types/post';
import { Timestamp } from 'firebase/firestore';

// Store session ID in memory (will be different for each page load)
let sessionId = Math.random().toString(36).substring(7);

/**
 * Generates a random seed that combines both time-based and session-based factors
 * This ensures posts get different boosts both on refresh and over time
 */
function getRandomSeed(postId: string): number {
  // Use a simpler but more aggressive randomization
  const hash = postId + sessionId;
  let hashValue = 0;
  for (let i = 0; i < hash.length; i++) {
    hashValue = ((hashValue << 5) - hashValue) + hash.charCodeAt(i);
    hashValue = hashValue & hashValue;
  }
  
  // Convert to a number between 0.1 and 5.0
  // This gives an extremely wide range of randomization
  return 0.1 + (Math.abs(hashValue) % 490) / 100;
}

/**
 * Calculates the relevance score for a post based on various factors:
 * - Base engagement (likes, comments, shares)
 * - Recency (time decay)
 * - Content type (videos and images get a boost)
 * - View count
 * - Very strong randomization factor (changes on refresh)
 * 
 * The randomization is extremely strong now to ensure maximum variety in the feed
 */
export function calculatePostScore(post: Post): number {
  const now = Timestamp.now();
  const postTime = post.createdAt instanceof Timestamp ? post.createdAt : Timestamp.fromDate(new Date(post.createdAt));
  
  // Time decay factor (posts older than 14 days get reduced score)
  const hoursSinceCreation = (now.seconds - postTime.seconds) / 3600;
  const timeDecay = Math.max(0, 1 - (hoursSinceCreation / (24 * 14)));
  
  // Base engagement score (minimal weight)
  const baseEngagementScore = 
    (post.likes * 0.1) + 
    (post.comments * 0.2) + 
    (post.shares * 0.3) +
    ((post.engagement?.views || 0) * 0.01);
  
  // Content type boost (minimal boost)
  const contentTypeBoost = post.mediaType === 'video' ? 1.05 : 
                          post.mediaType === 'image' ? 1.02 : 1;
  
  // Very strong randomization factor (changes on refresh)
  const randomFactor = getRandomSeed(post.id);
  
  // Calculate final score with extremely strong randomization
  const finalScore = baseEngagementScore * timeDecay * contentTypeBoost * randomFactor;
  
  return Math.round(finalScore * 100) / 100;
}

/**
 * Updates the relevance score for a post in Firestore
 * @param postId The ID of the post to update
 * @param score The new relevance score
 */
export async function updatePostScore(postId: string, score: number): Promise<void> {
  const { doc, updateDoc } = await import('firebase/firestore');
  const { db } = await import('../firebase/config');
  
  await updateDoc(doc(db, 'posts', postId), {
    'engagement.relevanceScore': score
  });
} 