'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import '@/styles/tab-navigation.css';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/lib/types/user';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { FiTwitter, FiInstagram, FiYoutube } from 'react-icons/fi';
import { HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';
import { ProfilePhoto } from './ProfilePhoto';
import { CoverPhoto } from './CoverPhoto';
import { doc, updateDoc, onSnapshot, getDoc, runTransaction, query, collection, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useChat } from '@/contexts/ChatContext';
import { formatDistanceToNow, formatDistanceToNowStrict } from 'date-fns';
import clsx from 'clsx';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const SUBSCRIPTIONS_API_URL = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || '';
import { Users, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { UserAvatar } from '@/components/user/UserAvatar';
import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { Share2, UserX } from 'lucide-react';
import { SocialLinksDisplay, SocialLink } from './SocialLinksDisplay';
import { blockUser, unblockUser, isUserBlocked } from '@/lib/services/block.service';
import { Button } from '@/components/ui/button';
import { SubscriptionContainer } from './SubscriptionContainer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { canViewProfile } from '@/lib/utils/profileVisibility';
import PlansModal from '@/components/creator/PlansModal';

interface Plan {
  id: string;
  name: string;
  price: number;
  duration: number;
  isActive: boolean;
  allowedCategories: string[];
  description?: string;
  discountPercent?: number;
  totalPrice?: number;
  creatorId: string;
}

interface ProfileHeaderProps {
  profile: UserProfile;
  isOwnProfile: boolean;
  profilePhotoUrl?: string;
  coverPhotoUrl?: string;
  onProfilePhotoUpdate?: (url: string) => void;
  onCoverPhotoUpdate?: (url: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  defaultSubscriptionPlanId?: string | null;
  defaultSubscriptionType?: 'free' | 'paid' | null;
  onSubscriptionCancelled?: () => void;
  tabCounts?: {
    feed: number;
    pictures: number;
    videos: number;
    videos360: number;
    vrvideos: number;
  };
}

export function ProfileHeader({
  profile,
  isOwnProfile,
  profilePhotoUrl,
  coverPhotoUrl,
  onProfilePhotoUpdate,
  onCoverPhotoUpdate,
  activeTab,
  onTabChange,
  onSubscriptionCancelled,
  tabCounts = { feed: 0, pictures: 0, videos: 0, videos360: 0, vrvideos: 0 },
}: ProfileHeaderProps) {
  console.log('🔍 ProfileHeader: isOwnProfile:', isOwnProfile);
  const { user } = useAuth();
  const { openChat } = useChat();
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState(profile.bio || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioClamped, setBioClamped] = useState(false);
  const bioRef = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [checkingBlockStatus, setCheckingBlockStatus] = useState(false);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  // Fixed button position - no more dragging
  const buttonsPosition = { x: 0, y: 0 };

  useEffect(() => {
    if (!bioExpanded && bioRef.current) {
      const el = bioRef.current;
      // Get the computed line height
      const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight);
      // 3 lines worth of height
      const maxHeight = lineHeight * 3;
      setBioClamped(el.scrollHeight > maxHeight + 1); // +1 for rounding
    } else if (bioExpanded) {
      setBioClamped(false);
    }
  }, [profile.bio, bioExpanded, bioValue]);

  useEffect(() => {
    if (!profile.id) return;
    const userRef = doc(db, 'users', profile.id);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      const data = docSnap.data();
      console.log('👤 Profile data loaded:', { 
        userId: profile.id, 
        hasSocialLinks: !!data?.socialLinks,
        socialLinks: data?.socialLinks 
      });
      if (data?.socialLinks) {
        setSocialLinks(data.socialLinks);
      } else {
        setSocialLinks([]);
      }
    });
    return () => unsubscribe();
  }, [profile.id]);



  // Check subscription status
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (isOwnProfile || !profile?.id) return;
      setCheckingSubscription(true);
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
          setIsSubscribed(false);
          setCheckingSubscription(false);
          return;
        }

        // First try to get subscription from Firebase
        const q = query(
          collection(db, 'subscriptions'),
          where('subscriberId', '==', user.uid),
          where('creatorId', '==', profile.id),
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
          setCheckingSubscription(false);
          return;
        }

        // If no subscription found in Firebase, try the API
        const response = await axios.get(
          `${SUBSCRIPTIONS_API_URL}/to/${profile.id}/latest`,
          {
            headers: {
              Authorization: `Bearer ${await user.getIdToken()}`
            }
          }
        );
        // Check if subscription is active or cancelled but still valid
        const now = Date.now();
        const isActive = response.data.status === 'active';
        const isCancelledButValid = response.data.status === 'cancelled' && 
          response.data.endDate && 
          new Date(response.data.endDate._seconds * 1000).getTime() > now;
        setIsSubscribed(isActive || isCancelledButValid);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setIsSubscribed(false);
        } else {
          console.error('Error checking subscription status:', error);
        }
      } finally {
        setCheckingSubscription(false);
      }
    };
    checkSubscriptionStatus();
  }, [profile?.id, isOwnProfile]);

  // Check if current user blocked the profile owner (for block/unblock button)
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (isOwnProfile || !user?.uid || !profile?.uid) return;
      
      setCheckingBlockStatus(true);
      try {
        // Check if current user blocked the profile owner (for button display)
        const userBlockedProfile = await isUserBlocked(user.uid, profile.uid);
        
        setIsBlocked(userBlockedProfile);
        console.log('[ProfileHeader] Block status:', { 
          userBlockedProfile, 
          blocked: userBlockedProfile, 
          viewer: user.uid, 
          profile: profile.uid 
        });
      } catch (error) {
        console.error('Error checking block status:', error);
        setIsBlocked(false);
      } finally {
        setCheckingBlockStatus(false);
      }
    };
    
    checkBlockStatus();
  }, [user?.uid, profile?.uid, isOwnProfile]);



  const handleMessageClick = async () => {
    if (profile?.uid) {
      await openChat(profile);
    } else {
      console.error('Profile missing uid:', profile);
    }
  };


  const handleTabClick = useCallback((tab: string) => {
    console.log('🔄 Tab click:', { tab, currentActiveTab: activeTab });
    
    // Prevent rapid clicking
    if (tab === activeTab) return;
    
    if (typeof onTabChange === 'function') {
      console.log('✅ Calling onTabChange with:', tab);
      onTabChange(tab);
    } else {
      console.error('❌ onTabChange is not a function:', onTabChange);
    }
  }, [onTabChange, activeTab]);

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
    if (!user?.uid || !profile?.uid) return;

    setBlocking(true);
    try {
      await blockUser(user.uid, profile.uid);
      setIsBlocked(true);
      toast.success(`${profile.displayName} has been blocked`);
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblockUser = async () => {
    if (!user?.uid || !profile?.uid) return;

    setBlocking(true);
    try {
      await unblockUser(user.uid, profile.uid);
      setIsBlocked(false);
      toast.success(`${profile.displayName} has been unblocked`);
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast.error('Failed to unblock user');
    } finally {
      setBlocking(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user?.uid || !profile?.id || !subscriptionId) return;

    if (!confirm('Are you sure you want to cancel your subscription? You will keep access until the end of your paid period.')) {
      return;
    }

    setCancelingSubscription(true);
    try {
      // Find and update subscription in Firestore directly
      const subscriptionQuery = query(
        collection(db, 'subscriptions'),
        where('subscriberId', '==', user.uid),
        where('creatorId', '==', profile.id),
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
        // Get plan to calculate duration
        const planDoc = await getDoc(doc(db, 'plans', subscriptionData.planId));
        if (planDoc.exists()) {
          const planData = planDoc.data();
          const duration = planData.duration || 30; // Default 30 days
          const startDate = subscriptionData.startDate?.toDate ? subscriptionData.startDate.toDate() : new Date(subscriptionData.startDate || Date.now());
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + duration);
        } else {
          // If no plan, use 30 days from start or now
          const startDate = subscriptionData.startDate?.toDate ? subscriptionData.startDate.toDate() : new Date(subscriptionData.startDate || Date.now());
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 30);
        }
      } else {
        endDate = endDate.toDate ? endDate.toDate() : new Date(endDate);
      }

      // Convert endDate to Firestore Timestamp
      const endDateTimestamp = Timestamp.fromDate(endDate);
      const cancelledAtTimestamp = Timestamp.now();

      console.log('🔄 Cancelling subscription:', {
        subscriptionId: subscriptionDoc.id,
        subscriberId: user.uid,
        creatorId: profile.id,
        currentStatus: subscriptionData.status,
        willSetStatus: 'cancelled'
      });

      // Update subscription to cancelled
      await updateDoc(subscriptionDoc.ref, {
        status: 'cancelled',
        cancelledAt: cancelledAtTimestamp,
        endDate: endDateTimestamp,
        willRenew: false,
        updatedAt: cancelledAtTimestamp
      });

      console.log('✅ Subscription cancelled successfully:', {
        subscriptionId: subscriptionDoc.id,
        status: 'cancelled',
        endDate: endDate.toISOString()
      });

      setIsSubscribed(false);
      setSubscriptionId(null);
      
      // Notify parent component to refresh subscription status
      if (onSubscriptionCancelled) {
        onSubscriptionCancelled();
      }
      
      // Also manually trigger refresh multiple times to ensure Firestore update is processed
      setTimeout(() => {
        if (onSubscriptionCancelled) {
          onSubscriptionCancelled();
        }
      }, 300);
      
      setTimeout(() => {
        if (onSubscriptionCancelled) {
          onSubscriptionCancelled();
        }
      }, 1000);
      
      setTimeout(() => {
        if (onSubscriptionCancelled) {
          onSubscriptionCancelled();
        }
      }, 2000);
      
      toast.success('Subscription cancelled successfully. You will keep access until the end of your paid period.');
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription');
    } finally {
      setCancelingSubscription(false);
    }
  };



  return (
    <div className="w-full flex flex-col pb-4 sm:pb-8">
      {/* Cover Photo */}
      <CoverPhoto
        photoUrl={coverPhotoUrl || profile.coverPhotoUrl}
        onPhotoUpdate={onCoverPhotoUpdate}
        className="w-full h-40 sm:h-56"
        isOwnProfile={isOwnProfile}
      />
      
      {/* Profile Photo */}
      <div className="relative -mt-2 sm:-mt-4 -ml-1 sm:-ml-2">
            <ProfilePhoto
              photoUrl={profilePhotoUrl || profile.photoURL}
              size="lg"
              onPhotoUpdate={onProfilePhotoUpdate}
              isOwnProfile={isOwnProfile}
              userId={profile.id}
            />
          </div>

      {/* User Info and Action Buttons - Free positioning */}
      <div className="mt-4 sm:mt-6 px-4 sm:px-6">
          <div className="flex items-center justify-between -mt-16 sm:-mt-20 ml-28 sm:ml-32">
            {/* Name and Username - Positioned to the right of profile photo */}
            <div className="text-left translate-x-6 -translate-y-4 sm:translate-x-0 sm:translate-y-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                {profile.displayName || profile.username}
                <span className="text-sm text-gray-500">@{profile.username}</span>
              </h1>
            </div>

            {/* Action Buttons - Fixed Position */}
            <div className="inline-flex flex-wrap gap-3">
              {!isOwnProfile && !isBlocked && (
                <>
                  {/* Only show CHAT button if profile is public OR user is subscribed - Desktop only */}
                  {canViewProfile(profile, user?.uid || null, isSubscribed) && (
                    <button
                      onClick={handleMessageClick}
                      className="relative p-2 text-gray-600 hover:text-gray-700 focus:outline-none transition-all duration-300 w-12 h-12 flex items-center justify-center group hidden md:flex rounded-full bg-blue-50 hover:bg-blue-100"
                      title="Chat"
                      style={{
                        background: 'linear-gradient(135deg, #e0f2fe 0%, #bfdbfe 100%)',
                        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)'
                      }}
                    >
                      <Image 
                        src="/images/chat-icon.png" 
                        alt="Chat" 
                        width={28} 
                        height={28}
                        className="w-7 h-7 transition-transform duration-200 group-hover:scale-110"
                      />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

      {/* Bio Section */}
        <div className="-mt-4 px-4 sm:px-6">
        {editingBio ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (bioValue.length > 2000) {
                setError('Bio cannot exceed 2000 characters');
                return;
              }
              setSaving(true);
              setError('');
              try {
                const userRef = doc(db, 'users', profile.id);
                await updateDoc(userRef, { bio: bioValue });
                setEditingBio(false);
                profile.bio = bioValue;
              } catch (err) {
                setError('Failed to update bio.');
              } finally {
                setSaving(false);
              }
            }}
            className="flex flex-col gap-2"
          >
            <div className="space-y-2">
              <textarea
                className={`profile-bio-edit border rounded p-3 w-full text-gray-900 ${
                  bioValue.length > 1800 ? 'border-yellow-500' : ''
                } ${bioValue.length > 1950 ? 'border-red-500' : ''}`}
                value={bioValue}
                onChange={e => {
                  const newValue = e.target.value;
                  if (newValue.length <= 2000) {
                    setBioValue(newValue);
                  }
                }}
                rows={8}
                maxLength={2000}
                disabled={saving}
                placeholder="Write your bio here..."
                style={{
                  minHeight: '150px',
                  height: 'auto',
                  maxHeight: 'none',
                  resize: 'vertical'
                } as any}
              />
              <div className={`text-xs text-right ${
                bioValue.length > 1950 ? 'text-red-500' :
                bioValue.length > 1800 ? 'text-yellow-500' :
                'text-gray-500'
              }`}>
                {bioValue.length}/2000
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                type="submit" 
                className="profile-btn edit-bio" 
                disabled={saving || bioValue.length > 2000}
              >
                <span>{saving ? 'SAVING...' : 'SAVE'}</span>
              </button>
              <button 
                type="button" 
                className="profile-btn" 
                onClick={() => { 
                  setEditingBio(false); 
                  setBioValue(profile.bio || ''); 
                }} 
                disabled={saving}
              >
                <span>CANCEL</span>
              </button>
            </div>
            {error && <div className="text-red-500 text-sm">{error}</div>}
          </form>
        ) : (
          <>
            {profile.bio ? (
              (() => {
                const isClamped = !bioExpanded;
                return (
                  <div className="relative group max-w-2xl">
                    <span
                      ref={bioRef}
                      className="whitespace-pre-line block text-gray-600 bio-text-responsive"
                      style={{
                        fontSize: '13px',
                        ...(isClamped ? {
                          display: 'block',
                          maxHeight: '4.5rem', // 3 lines worth of height
                          overflow: 'hidden',
                          position: 'relative',
                        } : {})
                      }}
                    >
                      {profile.bio}
                    </span>
                    {isClamped && bioClamped && (
                      <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent" />
                    )}
                    {(!bioExpanded && bioClamped) && (
                      <button
                        className="mt-1 text-xs text-blue-600 hover:underline focus:outline-none z-10 relative"
                        onClick={() => setBioExpanded(true)}
                      >
                        Read more
                      </button>
                    )}
                    {(bioExpanded) && (
                      <button
                        className="mt-1 text-xs text-blue-600 hover:underline focus:outline-none z-10 relative"
                        onClick={() => setBioExpanded(false)}
                      >
                        Show less
                      </button>
                    )}
                    
                    {/* Social Links */}
                    <SocialLinksDisplay links={socialLinks} />
                  </div>
                );
              })()
            ) : (
              /* Show social links even if no bio */
              socialLinks.length > 0 && <SocialLinksDisplay links={socialLinks} />
            )}
          </>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex justify-center mt-4 mb-0 px-4 sm:px-6">
        <div className="tab-container">
          <input 
            type="radio" 
            name="tab" 
            id="tab1" 
            className="tab tab--1" 
            checked={activeTab === 'feed'}
            onChange={() => handleTabClick('feed')}
          />
          <label className="tab_label relative inline-flex items-center justify-center" htmlFor="tab1">
            Feed
          </label>

          <input 
            type="radio" 
            name="tab" 
            id="tab2" 
            className="tab tab--2" 
            checked={activeTab === 'pictures'}
            onChange={() => handleTabClick('pictures')}
          />
          <label className="tab_label relative inline-flex items-center justify-center" htmlFor="tab2">
            Pics
          </label>

          <input 
            type="radio" 
            name="tab" 
            id="tab3" 
            className="tab tab--3" 
            checked={activeTab === 'videos'}
            onChange={() => handleTabClick('videos')}
          />
          <label className="tab_label relative inline-flex items-center justify-center" htmlFor="tab3">
            Videos
          </label>

          <input 
            type="radio" 
            name="tab" 
            id="tab4" 
            className="tab tab--4" 
            checked={activeTab === 'videos360'}
            onChange={() => handleTabClick('videos360')}
          />
          <label className="tab_label relative inline-flex items-center justify-center" htmlFor="tab4">
            360°
          </label>

          <input 
            type="radio" 
            name="tab" 
            id="tab5" 
            className="tab tab--5" 
            checked={activeTab === 'vrvideos'}
            onChange={() => handleTabClick('vrvideos')}
          />
          <label className="tab_label relative inline-flex items-center justify-center" htmlFor="tab5">
            VR
          </label>

          <div className="indicator"></div>
        </div>
      </div>

      {/* Plans Modal */}
      {profile && (profile.id || profile.uid) && (
        <PlansModal
          open={showPlansModal}
          onClose={() => {
            setShowPlansModal(false);
            setPlans([]);
            if (onSubscriptionCancelled) {
              onSubscriptionCancelled();
            }
          }}
          creatorId={profile.id || profile.uid}
          plans={plans}
          onSelectPlan={() => {
            setShowPlansModal(false);
            setPlans([]);
            if (onSubscriptionCancelled) {
              onSubscriptionCancelled();
            }
          }}
          onSubscriptionCancelled={onSubscriptionCancelled}
        />
      )}
    </div>
  );
} 