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
  console.log('🔒 isUserBlocked called:', { blockerId, userId })
  try {
    const userDoc = await getDoc(doc(db, 'users', blockerId));
    if (!userDoc.exists()) {
      console.log('🔒 User document does not exist:', blockerId)
      return false;
    }
    
    const userData = userDoc.data();
    const blockedUsers = userData.blockedUsers || [];
    const isBlocked = blockedUsers.includes(userId);
    console.log('🔒 Block check result:', { 
      blockerId, 
      userId, 
      blockedUsers, 
      isBlocked 
    })
    return isBlocked;
  } catch (error) {
    console.error('❌ Error checking if user is blocked:', error);
    return false;
  }
}

/**
 * Get list of blocked users with their details (with pagination)
 */
export async function getBlockedUsers(
  blockerId: string, 
  limit: number = 20, 
  startAfter?: string
): Promise<{ users: BlockedUser[], hasMore: boolean, lastUserId?: string }> {
  try {
    const userDoc = await getDoc(doc(db, 'users', blockerId));
    if (!userDoc.exists()) return { users: [], hasMore: false };
    
    const userData = userDoc.data();
    const blockedUserIds = userData.blockedUsers || [];
    
    if (blockedUserIds.length === 0) return { users: [], hasMore: false };
    
    // Find starting index for pagination
    let startIndex = 0;
    if (startAfter) {
      startIndex = blockedUserIds.indexOf(startAfter) + 1;
      if (startIndex === 0) startIndex = 0; // If not found, start from beginning
    }
    
    // Get the slice of user IDs for this page
    const pageUserIds = blockedUserIds.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < blockedUserIds.length;
    const lastUserId = pageUserIds[pageUserIds.length - 1];
    
    if (pageUserIds.length === 0) return { users: [], hasMore: false };
    
    // Get user details for blocked users in this page
    const blockedUsersData = await Promise.all(
      pageUserIds.map(async (userId: string) => {
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
    
    const users = blockedUsersData.filter(Boolean) as BlockedUser[];
    return { users, hasMore, lastUserId };
  } catch (error) {
    console.error('Error getting blocked users:', error);
    throw new Error('Failed to get blocked users');
  }
}

/**
 * Check if current user's content should be hidden from a viewer (one-way blocking)
 * Returns true if the viewer blocked the current user
 */
export async function isContentHiddenFromViewer(contentCreatorId: string, viewerId: string): Promise<boolean> {
  try {
    // Check if the viewer blocked the content creator
    return await isUserBlocked(viewerId, contentCreatorId);
  } catch (error) {
    console.error('Error checking if content is hidden from viewer:', error);
    return false;
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
