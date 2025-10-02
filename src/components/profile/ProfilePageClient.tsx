'use client';

import { useState } from 'react';
import { ProfileHeader } from './ProfileHeader';
import { ProfileContent } from './ProfileContent';
import { UserProfile } from '@/lib/types/user';

interface ProfilePageClientProps {
  profile: UserProfile;
  isOwnProfile: boolean;
}

export function ProfilePageClient({ profile, isOwnProfile }: ProfilePageClientProps) {
  console.log('🔍 ProfilePageClient: isOwnProfile:', isOwnProfile);
  const [activeTab, setActiveTab] = useState('feed');
  const [profileState, setProfileState] = useState(profile);

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
      <ProfileContent profile={profileState} activeTab={activeTab} />
    </div>
  );
} 