'use client';

import { useState, useEffect } from 'react';
import { ProfileHeader } from './ProfileHeader';
import { ProfileContent } from './ProfileContent';
import { UserProfile } from '@/lib/types/user';
import { useAuth } from '@/hooks/useAuth';
import { isUserBlocked } from '@/lib/services/block.service';
import { SubscriptionContainer } from './SubscriptionContainer';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

interface ProfilePageClientProps {
  profile: UserProfile;
  isOwnProfile: boolean;
}

export function ProfilePageClient({ profile, isOwnProfile }: ProfilePageClientProps) {
  console.log('🔍 ProfilePageClient: isOwnProfile:', isOwnProfile);
  const [activeTab, setActiveTab] = useState('feed');
  const [profileState, setProfileState] = useState(profile);
  const [isBlocked, setIsBlocked] = useState(false);
  const [checkingBlock, setCheckingBlock] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const { user } = useAuth();
  
  // Check if profile owner is a creator
  useEffect(() => {
    const checkCreatorStatus = async () => {
      if (!profile?.role) {
        console.log('❌ No profile role found');
        return;
      }
      const creatorRoles = ['creator', 'admin', 'superadmin', 'owner'];
      const isCreatorUser = creatorRoles.includes(profile.role);
      console.log('🔍 Creator status check:', { 
        profileId: profile?.uid,
        role: profile.role, 
        isCreator: isCreatorUser,
        inList: creatorRoles.includes(profile.role)
      });
      setIsCreator(isCreatorUser);
    };
    checkCreatorStatus();
  }, [profile?.role]);

  // Check subscription status for non-own profiles
  const { isSubscriber } = useSubscriptionStatus(isOwnProfile ? '' : profile?.uid || '');

  // Check if current user is blocked by the profile owner (one-way blocking)
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (isOwnProfile || !user?.uid || !profile?.uid) {
        setIsBlocked(false);
        setCheckingBlock(false);
        return;
      }
      
      setCheckingBlock(true);
      try {
        // Only check if profile owner blocked current user (one-way blocking)
        const profileBlockedUser = await isUserBlocked(profile.uid, user.uid);
        
        setIsBlocked(profileBlockedUser);
        console.log('[ProfilePageClient] Block status:', { 
          profileBlockedUser, 
          blocked: profileBlockedUser, 
          viewer: user.uid, 
          profile: profile.uid 
        });
      } catch (error) {
        console.error('Error checking block status:', error);
        setIsBlocked(false);
      } finally {
        setCheckingBlock(false);
      }
    };
    
    checkBlockStatus();
  }, [user?.uid, profile?.uid, isOwnProfile]);

  const handleTabChange = (tab: string) => {
    console.log('Changing tab to:', tab);
    setActiveTab(tab);
  };

  const handleProfilePhotoUpdate = (url: string) => {
    console.log('Profile photo update:', url);
    setProfileState((prev) => ({ ...prev, photoURL: url }));
  };

  const handleCoverPhotoUpdate = (url: string) => {
    console.log('Cover photo update:', url);
    setProfileState((prev) => ({ ...prev, coverPhotoUrl: url }));
  };

  // Completely hide blocked profiles - no content shown
  if (isBlocked) {
    return null;
  }

  // Show loading while checking block status
  if (checkingBlock) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <ProfileHeader
        profile={profileState}
        isOwnProfile={isOwnProfile}
        profilePhotoUrl={profileState.photoURL}
        coverPhotoUrl={profileState.coverPhotoUrl}
        onProfilePhotoUpdate={isOwnProfile ? handleProfilePhotoUpdate : undefined}
        onCoverPhotoUpdate={isOwnProfile ? handleCoverPhotoUpdate : undefined}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      
      {/* Show Subscription Container for creators and non-own profiles - Right after tabs */}
      {!isOwnProfile && isCreator && profileState.uid && (
        <>
          {console.log('✅ Showing Subscription Container', { 
            isOwnProfile, 
            isCreator, 
            profileId: profileState.uid, 
            role: profileState.role,
            uid: profileState.uid
          })}
          <div className="w-full px-4 py-1 flex justify-center -mt-6">
            <div className="w-full max-w-2xl">
              <SubscriptionContainer
                creatorId={profileState.uid}
                isSubscribed={isSubscriber}
                checkingSubscription={false}
                onSubscribe={(planId, price, duration) => {
                  // Handle subscription completion
                  console.log('Subscription completed:', { planId, price, duration });
                }}
              />
            </div>
          </div>
        </>
      )}
      
      <ProfileContent profile={profileState} activeTab={activeTab} />
    </div>
  );
} 