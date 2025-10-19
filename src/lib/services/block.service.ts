import { db } from '@/lib/firebase/config';
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from 'firebase/firestore';

export interface BlockedUser {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
  blockedAt: Date;
}

/**
 * Block a user
 */
export async function blockUser(blockerId: string, userToBlockId: string): Promise<void> {
  try {
    // Add to blocked users array
    await updateDoc(doc(db, 'users', blockerId), {
      blockedUsers: arrayUnion(userToBlockId),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    throw new Error('Failed to block user');
  }
}

/**
 * Unblock a user
 */
export async function unblockUser(blockerId: string, userToUnblockId: string): Promise<void> {
  try {
    // Remove from blocked users array
    await updateDoc(doc(db, 'users', blockerId), {
      blockedUsers: arrayRemove(userToUnblockId),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    throw new Error('Failed to unblock user');
  }
}

/**
 * Check if a user is blocked
 */
export async function isUserBlocked(blockerId: string, userId: string): Promise<boolean> {
  try {
    const userDoc = await getDoc(doc(db, 'users', blockerId));
    if (!userDoc.exists()) return false;
    
    const userData = userDoc.data();
    const blockedUsers = userData.blockedUsers || [];
    return blockedUsers.includes(userId);
  } catch (error) {
    console.error('Error checking if user is blocked:', error);
    return false;
  }
}

/**
 * Get list of blocked users with their details
 */
export async function getBlockedUsers(blockerId: string): Promise<BlockedUser[]> {
  try {
    const userDoc = await getDoc(doc(db, 'users', blockerId));
    if (!userDoc.exists()) return [];
    
    const userData = userDoc.data();
    const blockedUserIds = userData.blockedUsers || [];
    
    if (blockedUserIds.length === 0) return [];
    
    // Get user details for blocked users
    const blockedUsersData = await Promise.all(
      blockedUserIds.map(async (userId: string) => {
        try {
          const blockedUserDoc = await getDoc(doc(db, 'users', userId));
          if (blockedUserDoc.exists()) {
            const blockedUserData = blockedUserDoc.data();
            return {
              uid: userId,
              displayName: blockedUserData.displayName || 'Unknown User',
              username: blockedUserData.username || 'unknown',
              photoURL: blockedUserData.photoURL,
              blockedAt: new Date(), // We'll need to store this separately for accuracy
            };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching blocked user ${userId}:`, error);
          return null;
        }
      })
    );
    
    return blockedUsersData.filter(Boolean) as BlockedUser[];
  } catch (error) {
    console.error('Error getting blocked users:', error);
    throw new Error('Failed to get blocked users');
  }
}

/**
 * Search users by username (excluding blocked users)
 */
export async function searchUsers(
  searchQuery: string, 
  currentUserId: string, 
  blockedUserIds: string[] = []
): Promise<any[]> {
  try {
    // This is a simplified search - in production you'd want to use Algolia or similar
    // For now, we'll search by username prefix
    const usersQuery = query(
      collection(db, 'users'),
      where('username', '>=', searchQuery.toLowerCase()),
      where('username', '<=', searchQuery.toLowerCase() + '\uf8ff')
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    const results: any[] = [];

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      // Don't include the current user or already blocked users
      if (userData.uid !== currentUserId && !blockedUserIds.includes(userData.uid)) {
        results.push(userData);
      }
    });

    return results;
  } catch (error) {
    console.error('Error searching users:', error);
    throw new Error('Failed to search users');
  }
}
