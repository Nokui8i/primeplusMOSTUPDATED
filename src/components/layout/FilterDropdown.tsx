"use client";

import { useState, useEffect } from 'react';
import { FiMoreVertical } from 'react-icons/fi';
import { Share2, UserX } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useFilter } from '@/contexts/FilterContext';
import { UserProfile } from '@/lib/types/user';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { doc, updateDoc, query, collection, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { toast } from 'sonner';
import { blockUser, unblockUser, isUserBlocked } from '@/lib/services/block.service';
import { canViewProfile } from '@/lib/utils/profileVisibility';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import PlansModal from '@/components/creator/PlansModal';

interface FilterDropdownProps {
  profileData?: UserProfile | null;
  isProfilePage?: boolean;
}

export function FilterDropdown({ profileData = null, isProfilePage = false }: FilterDropdownProps) {
  const { hideLockedPosts, setHideLockedPosts } = useFilter();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isBlocked, setIsBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [checkingBlockStatus, setCheckingBlockStatus] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState(profileData?.bio || '');
  const [localProfileData, setLocalProfileData] = useState<UserProfile | null>(profileData);
  const [userRole, setUserRole] = useState<'user' | 'creator' | 'admin' | 'superadmin' | 'owner'>('user');
  
  // Fallback: Detect profile page from pathname if not passed as prop
  const detectedIsProfilePage = isProfilePage || (pathname?.startsWith('/profile/') || (pathname && pathname.split('/').length === 2 && pathname.split('/')[1] && !['home', 'messages', 'subscriptions', 'settings', 'notifications', 'search', 'creator', 'admin', 'complete-profile'].includes(pathname.split('/')[1])));
  
  // Fetch current user's role
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.uid) {
        setUserRole('user');
        return;
      }
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = userData.role || 'user';
          setUserRole(role);
          console.log('🔍 FilterDropdown - User role:', role);
        } else {
          setUserRole('user');
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        setUserRole('user');
      }
    };
    
    fetchUserRole();
  }, [user?.uid]);
  
  // Fetch profile data if not provided and we're on a profile page
  useEffect(() => {
    const fetchProfileData = async () => {
      // If profileData is provided as prop, use it
      if (profileData) {
        setLocalProfileData(profileData);
        console.log('✅ FilterDropdown: Using profileData from props');
        return;
      }
      
      // If not on profile page, clear data
      if (!detectedIsProfilePage) {
        setLocalProfileData(null);
        return;
      }
      
      // Don't require user to be logged in to fetch profile data
      try {
        const profileUsername = pathname?.startsWith('/profile/') 
          ? pathname.split('/profile/')[1]?.split('/')[0] 
          : pathname?.split('/')[1];
        
        if (!profileUsername) {
          console.log('⚠️ FilterDropdown: No username found in pathname');
          setLocalProfileData(null);
          return;
        }
        
        console.log('🔍 FilterDropdown: Fetching profile for username:', profileUsername);
        const profileQuery = query(
          collection(db, 'users'),
          where('username', '==', profileUsername)
        );
        const profileSnapshot = await getDocs(profileQuery);
        
        if (!profileSnapshot.empty) {
          const profileDoc = profileSnapshot.docs[0];
          const data = profileDoc.data();
          const profile: UserProfile = {
            id: profileDoc.id,
            uid: profileDoc.id,
            username: data.username || '',
            email: data.email || '',
            displayName: data.displayName || data.username || '',
            photoURL: data.photoURL || data.profilePhotoUrl || null,
            coverPhotoUrl: data.coverPhotoUrl || null,
            role: data.role || 'user',
            isVerified: data.isVerified || false,
            isAgeVerified: data.isAgeVerified || false,
            status: data.status || 'active',
            bio: data.bio,
            privacy: data.privacy || { profileVisibility: 'public' },
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };
          
          setLocalProfileData(profile);
          console.log('✅ FilterDropdown: Profile data fetched successfully:', profile.displayName);
        } else {
          console.log('⚠️ FilterDropdown: No profile found for username:', profileUsername);
          setLocalProfileData(null);
        }
      } catch (error) {
        console.error('❌ Error fetching profile in FilterDropdown:', error);
        setLocalProfileData(null);
      }
    };
    
    fetchProfileData();
  }, [profileData, detectedIsProfilePage, pathname]);

  const isOwnProfile = localProfileData && user?.uid && (user.uid === localProfileData.uid || user.uid === localProfileData.id);
  const { isSubscriber } = useSubscriptionStatus(localProfileData?.uid || '');

  // Check if user is blocked
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!detectedIsProfilePage || isOwnProfile || !user?.uid || !localProfileData?.uid) {
        setIsBlocked(false);
        setCheckingBlockStatus(false);
        return;
      }
      
      setCheckingBlockStatus(true);
      try {
        const profileBlockedUser = await isUserBlocked(localProfileData.uid, user.uid);
        setIsBlocked(profileBlockedUser);
      } catch (error) {
        console.error('Error checking block status:', error);
        setIsBlocked(false);
      } finally {
        setCheckingBlockStatus(false);
      }
    };
    
    checkBlockStatus();
  }, [detectedIsProfilePage, isOwnProfile, user?.uid, localProfileData?.uid]);

  // Check subscription status
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!detectedIsProfilePage || isOwnProfile || !localProfileData?.id) return;
      setCheckingSubscription(true);
      try {
        const q = query(
          collection(db, 'subscriptions'),
          where('subscriberId', '==', user?.uid),
          where('creatorId', '==', localProfileData.id),
          where('status', 'in', ['active', 'cancelled'])
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const now = new Date();
          let foundActiveSubscription = false;
          let foundSubscriptionId = null;
          
          querySnapshot.docs.forEach(doc => {
            const data = doc.data();
            const isActive = data.status === 'active';
            const isCancelledButValid = data.status === 'cancelled' && 
              data.endDate && 
              data.endDate.toDate() > now;
            if (isActive || isCancelledButValid) {
              foundActiveSubscription = true;
              if (isActive) {
                foundSubscriptionId = doc.id;
              }
            }
          });
          
          setIsSubscribed(foundActiveSubscription);
          setSubscriptionId(foundSubscriptionId);
        } else {
          setIsSubscribed(false);
        }
      } catch (error) {
        console.error('Error checking subscription status:', error);
        setIsSubscribed(false);
      } finally {
        setCheckingSubscription(false);
      }
    };
    
    checkSubscriptionStatus();
  }, [detectedIsProfilePage, isOwnProfile, localProfileData?.id, user?.uid]);

  const handleShare = async () => {
    const currentUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(currentUrl);
      toast.success('Profile link copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const handleBlockUser = async () => {
    if (!user?.uid || !localProfileData?.uid) return;
    setBlocking(true);
    try {
      await blockUser(user.uid, localProfileData.uid);
      setIsBlocked(true);
      toast.success(`${localProfileData.displayName} has been blocked`);
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblockUser = async () => {
    if (!user?.uid || !localProfileData?.uid) return;
    setBlocking(true);
    try {
      await unblockUser(user.uid, localProfileData.uid);
      setIsBlocked(false);
      toast.success(`${localProfileData.displayName} has been unblocked`);
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast.error('Failed to unblock user');
    } finally {
      setBlocking(false);
    }
  };

  const handleEditBio = () => {
    if (localProfileData?.bio) {
      setBioValue(localProfileData.bio);
    }
    setEditingBio(true);
    // Navigate to profile settings or open bio editor
    router.push('/settings');
  };

  const handleCancelSubscription = async () => {
    if (!user?.uid || !localProfileData?.id || !subscriptionId) return;
    if (!confirm('Are you sure you want to cancel your subscription? You will keep access until the end of your paid period.')) {
      return;
    }

    setPlansLoading(true);
    try {
      const subscriptionQuery = query(
        collection(db, 'subscriptions'),
        where('subscriberId', '==', user.uid),
          where('creatorId', '==', localProfileData.id),
        where('status', '==', 'active')
      );
      const querySnapshot = await getDocs(subscriptionQuery);
      
      if (querySnapshot.empty) {
        toast.error('No active subscription found');
        return;
      }

      const subscriptionDoc = querySnapshot.docs[0];
      const subscriptionData = subscriptionDoc.data();
      
      // Calculate end date if not set
      let endDate = subscriptionData.endDate;
      if (!endDate) {
        const planDoc = await getDocs(query(collection(db, 'plans'), where('id', '==', subscriptionData.planId)));
        if (!planDoc.empty) {
          const planData = planDoc.docs[0].data();
          const duration = planData.duration || 30;
          const startDate = subscriptionData.startDate?.toDate ? subscriptionData.startDate.toDate() : new Date(subscriptionData.startDate || Date.now());
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + duration);
        }
      } else {
        endDate = endDate.toDate ? endDate.toDate() : new Date(endDate);
      }

      await updateDoc(subscriptionDoc.ref, {
        status: 'cancelled',
        endDate: endDate,
        willRenew: false,
        updatedAt: new Date()
      });

      setIsSubscribed(false);
      setSubscriptionId(null);
      toast.success('Subscription cancelled successfully. You will keep access until the end of your paid period.');
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription');
    } finally {
      setPlansLoading(false);
    }
  };

  const handleOpenPlansModal = async () => {
    setPlansLoading(true);
    try {
      const q = query(
        collection(db, 'plans'),
        where('creatorId', '==', localProfileData?.id || localProfileData?.uid)
      );
      const snap = await getDocs(q);
      const plansData = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          price: data.price || 0,
          duration: data.duration || 30,
          isActive: data.isActive || false,
          allowedCategories: data.allowedCategories || [],
          description: data.description,
          discountPercent: data.discountPercent,
          totalPrice: data.totalPrice,
          creatorId: data.creatorId || localProfileData?.id || localProfileData?.uid
        };
      });
      setPlans(plansData);
      setShowPlansModal(true);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setPlans([]);
      setShowPlansModal(true);
    } finally {
      setPlansLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            className="relative p-1.5 text-gray-600 hover:text-gray-700 focus:outline-none transition-colors"
            aria-label="Filter options"
          >
            <FiMoreVertical className="w-5 h-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-44 border p-1.5"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            boxShadow: `
              0 20px 60px rgba(0, 0, 0, 0.12),
              0 8px 25px rgba(0, 0, 0, 0.08),
              0 0 0 1px rgba(255, 255, 255, 0.5) inset,
              0 2px 4px rgba(0, 0, 0, 0.04) inset
            `,
            backdropFilter: 'blur(10px)',
            transform: 'translateY(-2px)',
            transition: 'all 0.3s ease',
            borderRadius: '0.5rem',
            maxHeight: '400px',
            overflowY: 'auto'
          }}
        >
          {/* Profile Page Options - Always show Share and Block when on profile page */}
          {detectedIsProfilePage && (
            <>
              {/* Share Button - Always show on profile pages */}
              <DropdownMenuItem
                onClick={handleShare}
                className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 rounded-md px-2 py-1.5 transition-colors"
              >
                <Share2 className="h-3 w-3 text-gray-500" />
                <span className="text-xs text-gray-700">Share</span>
              </DropdownMenuItem>
              
              {/* Edit Bio - Only for own profile */}
              {isOwnProfile && localProfileData && (
                <DropdownMenuItem
                  onClick={handleEditBio}
                  className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 rounded-md px-2 py-1.5 transition-colors"
                >
                  <svg className="h-3 w-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="text-xs text-gray-700">{localProfileData.bio ? 'Edit Bio' : 'Add Bio'}</span>
                </DropdownMenuItem>
              )}
              
              {/* Cancel Subscription - Show if subscribed (not own profile) */}
              {!isOwnProfile && isSubscribed && subscriptionId && (
                <DropdownMenuItem
                  onClick={handleOpenPlansModal}
                  disabled={plansLoading}
                  className="flex items-center gap-2 cursor-pointer hover:bg-red-50 rounded-md px-2 py-1.5 transition-colors text-red-600"
                >
                  {plansLoading ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                  ) : (
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className="text-xs">Cancel Subscription</span>
                </DropdownMenuItem>
              )}
              
              {/* Block/Unblock - Always show when visiting someone else's profile and logged in */}
              {!isOwnProfile && user?.uid && (
                <>
                  {isBlocked ? (
                    <DropdownMenuItem
                      onClick={handleUnblockUser}
                      disabled={blocking || checkingBlockStatus}
                      className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 rounded-md px-2 py-1.5 transition-colors"
                    >
                      {blocking || checkingBlockStatus ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-black"></div>
                      ) : (
                        <UserX className="h-3 w-3 text-gray-500" />
                      )}
                      <span className="text-xs text-gray-700">Unblock</span>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={handleBlockUser}
                      disabled={blocking || checkingBlockStatus}
                      className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 rounded-md px-2 py-1.5 transition-colors"
                    >
                      {blocking || checkingBlockStatus ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-black"></div>
                      ) : (
                        <UserX className="h-3 w-3 text-gray-500" />
                      )}
                      <span className="text-xs text-gray-700">Block</span>
                    </DropdownMenuItem>
                  )}
                </>
              )}
              
              <DropdownMenuSeparator className="my-1" />
            </>
          )}
          
          {/* Filter Options - Only show for creators/admins, NOT regular users */}
          {(userRole === 'creator' || userRole === 'admin' || userRole === 'superadmin' || userRole === 'owner') && (
            <DropdownMenuItem
              onClick={() => setHideLockedPosts(!hideLockedPosts)}
              className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 rounded-md px-2 py-1.5 transition-colors"
            >
              <input
                type="checkbox"
                checked={hideLockedPosts}
                onChange={() => setHideLockedPosts(!hideLockedPosts)}
                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs text-gray-700">Hide Locked Posts</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Plans Modal */}
      {localProfileData && (localProfileData.id || localProfileData.uid) && (
        <PlansModal
          open={showPlansModal}
          onClose={() => {
            setShowPlansModal(false);
            setPlans([]);
          }}
          creatorId={localProfileData.id || localProfileData.uid}
          plans={plans}
          onSelectPlan={() => {
            setShowPlansModal(false);
            setPlans([]);
          }}
          onSubscriptionCancelled={() => {
            setIsSubscribed(false);
            setSubscriptionId(null);
          }}
        />
      )}
    </>
  );
}

