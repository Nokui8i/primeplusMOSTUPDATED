import { UserProfile } from '@/lib/types/user';

export type ProfileVisibility = 'public' | 'subscribers_only';

/**
 * Check if a user can view another user's profile based on privacy settings
 * @param profileOwner - The user whose profile is being accessed
 * @param viewerId - The ID of the user trying to view the profile
 * @param isSubscriber - Whether the viewer is a subscriber of the profile owner
 * @returns boolean indicating if the viewer can access the profile
 */
export function canViewProfile(
  profileOwner: UserProfile,
  viewerId: string | null,
  isSubscriber: boolean = false
): boolean {
  // Profile owner can always view their own profile
  if (viewerId === profileOwner.uid) {
    return true;
  }

  // If no viewer, only allow if profile is public
  if (!viewerId) {
    return profileOwner.privacy?.profileVisibility === 'public' || !profileOwner.privacy?.profileVisibility;
  }

  // Check profile visibility setting
  const visibility = profileOwner.privacy?.profileVisibility || 'public';

  switch (visibility) {
    case 'public':
      return true;
    
    case 'subscribers_only':
      return isSubscriber;
    
    default:
      return true; // Default to public if unknown setting
  }
}

/**
 * Get the appropriate message to show when profile access is denied
 * @param profileOwner - The user whose profile is being accessed
 * @param isSubscriber - Whether the viewer is a subscriber of the profile owner
 * @returns string message to display
 */
export function getProfileAccessDeniedMessage(
  profileOwner: UserProfile,
  isSubscriber: boolean = false
): string {
  const visibility = profileOwner.privacy?.profileVisibility || 'public';

  switch (visibility) {
    case 'subscribers_only':
      return isSubscriber 
        ? 'This profile is only visible to subscribers.' 
        : 'Subscribe to view this profile.';
    
    default:
      return 'You cannot view this profile.';
  }
}

/**
 * Check if a user can view another user's posts based on profile visibility
 * @param profileOwner - The user whose posts are being accessed
 * @param viewerId - The ID of the user trying to view the posts
 * @param isSubscriber - Whether the viewer is a subscriber of the profile owner
 * @returns boolean indicating if the viewer can access the posts
 */
export function canViewProfilePosts(
  profileOwner: UserProfile,
  viewerId: string | null,
  isSubscriber: boolean = false
): boolean {
  // Profile owner can always view their own posts
  if (viewerId === profileOwner.uid) {
    return true;
  }

  // If no viewer, only allow if profile is public
  if (!viewerId) {
    return profileOwner.privacy?.profileVisibility === 'public' || !profileOwner.privacy?.profileVisibility;
  }

  // Check profile visibility setting
  const visibility = profileOwner.privacy?.profileVisibility || 'public';

  switch (visibility) {
    case 'public':
      return true;
    
    case 'subscribers_only':
      return isSubscriber;
    
    default:
      return true; // Default to public if unknown setting
  }
}
