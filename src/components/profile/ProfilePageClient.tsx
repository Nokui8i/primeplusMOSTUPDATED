'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProfileHeader } from './ProfileHeader';
import { ProfileContent } from './ProfileContent';
import { UserProfile } from '@/lib/types/user';
import { useAuth } from '@/hooks/useAuth';
import { isUserBlocked } from '@/lib/services/block.service';
import { SubscriptionContainer } from './SubscriptionContainer';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { query, collection, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface ProfilePageClientProps {
  profile: UserProfile;
  isOwnProfile: boolean;
}

// Create a context or use a callback ref to force refresh
let forceRefreshSubscription: (() => void) | null = null;

export function ProfilePageClient({ profile, isOwnProfile }: ProfilePageClientProps) {
  console.log('🔍 ProfilePageClient: isOwnProfile:', isOwnProfile);
  const [activeTab, setActiveTab] = useState('feed');
  const [profileState, setProfileState] = useState(profile);
  const [isBlocked, setIsBlocked] = useState(false);
  const [checkingBlock, setCheckingBlock] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [tabCounts, setTabCounts] = useState({
    feed: 0,
    pictures: 0,
    videos: 0,
    videos360: 0,
    vrvideos: 0,
  });
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
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  // Force refresh function to check subscription status
  const refreshSubscriptionStatus = useCallback(async () => {
    if (isOwnProfile || !user?.uid || !profile?.uid) {
      setHasActiveSubscription(false);
      return;
    }

    try {
      // Check for active subscriptions OR cancelled but still valid subscriptions
      const subscriptionQuery = query(
        collection(db, 'subscriptions'),
        where('subscriberId', '==', user.uid),
        where('creatorId', '==', profile.uid),
        where('status', 'in', ['active', 'cancelled'])
      );
      const querySnapshot = await getDocs(subscriptionQuery);
      
      const now = new Date();
      let hasActive = false;
      
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Only consider subscriptions with status 'active' as active
        // Cancelled subscriptions should not prevent showing subscription options
        if (data.status === 'active') {
          hasActive = true;
        }
      });
      
      console.log('🔄 Force refresh subscription status:', {
        hasActive,
        totalCount: querySnapshot.size,
        userId: user.uid,
        creatorId: profile.uid,
        docs: querySnapshot.docs.map(d => {
          const data = d.data();
          const endDate = data.endDate ? (data.endDate.toDate ? data.endDate.toDate() : new Date(data.endDate)) : null;
          return { 
            id: d.id, 
            status: data.status, 
            endDate: endDate?.toISOString(),
            isValid: data.status === 'active'
          };
        })
      });
      
      setHasActiveSubscription(hasActive);
    } catch (error) {
      console.error('Error refreshing subscription status:', error);
      setHasActiveSubscription(false);
    }
  }, [isOwnProfile, user?.uid, profile?.uid]);

  // Check if subscription is active (not cancelled) - use real-time listener
  useEffect(() => {
    if (isOwnProfile || !user?.uid || !profile?.uid) {
      setHasActiveSubscription(false);
      forceRefreshSubscription = null;
      return;
    }

    // Set up force refresh function
    forceRefreshSubscription = refreshSubscriptionStatus;

    let unsubscribe: (() => void) | null = null;

    const setupSubscriptionListener = () => {
      try {
        // Listen to both active and cancelled subscriptions
        const subscriptionQuery = query(
          collection(db, 'subscriptions'),
          where('subscriberId', '==', user.uid),
          where('creatorId', '==', profile.uid),
          where('status', 'in', ['active', 'cancelled'])
        );
        
        // Use real-time listener to update when subscription changes
        unsubscribe = onSnapshot(subscriptionQuery, (querySnapshot) => {
          const now = new Date();
          let hasActive = false;
          
          querySnapshot.docs.forEach(doc => {
            const data = doc.data();
            // Only consider subscriptions with status 'active' as active
            // Cancelled subscriptions should not prevent showing subscription options
            if (data.status === 'active') {
              hasActive = true;
            }
          });
          
          console.log('📊 Subscription listener update:', {
            hasActive,
            totalCount: querySnapshot.size,
            userId: user.uid,
            creatorId: profile.uid,
            docs: querySnapshot.docs.map(d => {
              const data = d.data();
              const endDate = data.endDate ? (data.endDate.toDate ? data.endDate.toDate() : new Date(data.endDate)) : null;
              return { 
                id: d.id, 
                status: data.status, 
                endDate: endDate?.toISOString(),
                isValid: data.status === 'active'
              };
            })
          });
          
          setHasActiveSubscription(hasActive);
          
          // Also do a manual refresh to ensure consistency
          refreshSubscriptionStatus();
        }, (error) => {
          console.error('Error listening to subscription:', error);
          setHasActiveSubscription(false);
        });
      } catch (error) {
        console.error('Error setting up subscription listener:', error);
        setHasActiveSubscription(false);
      }
    };

    setupSubscriptionListener();
    
    // Initial check
    refreshSubscriptionStatus();
    
    // Also set up periodic refresh to catch any missed updates
    const refreshInterval = setInterval(() => {
      refreshSubscriptionStatus();
    }, 2000); // Check every 2 seconds

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      clearInterval(refreshInterval);
      forceRefreshSubscription = null;
    };
  }, [isOwnProfile, user?.uid, profile?.uid, refreshSubscriptionStatus]);

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
        onSubscriptionCancelled={refreshSubscriptionStatus}
        tabCounts={tabCounts}
      />
      
      {/* Show Subscription Container for creators and non-own profiles - Right after tabs */}
      {/* Hide if user has active subscription, show if cancelled or not subscribed */}
      {!isOwnProfile && isCreator && profileState.uid && !hasActiveSubscription && (
        <>
          {console.log('✅ Showing Subscription Container', { 
            isOwnProfile, 
            isCreator, 
            profileId: profileState.uid, 
            role: profileState.role,
            uid: profileState.uid,
            isSubscriber
          })}
          <div className="w-full px-4 py-1 flex justify-center mt-2">
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
      
      <ProfileContent 
        profile={profileState} 
        activeTab={activeTab}
        onCountsChange={setTabCounts}
      />
    </div>
  );
} 