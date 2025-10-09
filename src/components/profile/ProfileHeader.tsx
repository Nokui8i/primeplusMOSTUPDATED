'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import '@/styles/tab-navigation.css';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/lib/types/user';
import { Badge } from '@/components/ui/badge';
import { FiTwitter, FiInstagram, FiYoutube } from 'react-icons/fi';
import { HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';
import { ProfilePhoto } from './ProfilePhoto';
import { CoverPhoto } from './CoverPhoto';
import { doc, updateDoc, onSnapshot, getDoc, runTransaction, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useChat } from '@/contexts/ChatContext';
import { formatDistanceToNow, formatDistanceToNowStrict } from 'date-fns';
import clsx from 'clsx';
import { GoLiveButton } from '@/components/live/GoLiveButton';
import { LiveStreamDialog } from '@/components/live/LiveStreamDialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const SUBSCRIPTIONS_API_URL = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || '';
import LiveKitStream from '@/components/live/LiveKitStream';
import LiveChat from '@/components/live/LiveChat';
import { Users, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import LiveStreamPopup from '@/components/live/LiveStreamPopup';
import { UserAvatar } from '@/components/user/UserAvatar';
import { FollowButton, useFollowStats } from '@/components/FollowButton';
import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { Share2 } from 'lucide-react';
import { SocialLinksDisplay, SocialLink } from './SocialLinksDisplay';

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
}: ProfileHeaderProps) {
  console.log('🔍 ProfileHeader: isOwnProfile:', isOwnProfile);
  const { openChat } = useChat();
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState(profile.bio || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioClamped, setBioClamped] = useState(false);
  const bioRef = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  
  const [showLiveDialog, setShowLiveDialog] = useState(false);
  const [showLiveStreamPopup, setShowLiveStreamPopup] = useState(false);
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [hasUnfinishedStream, setHasUnfinishedStream] = useState(false);
  const { stats, isLoading: isFollowStatsLoading } = useFollowStats(profile.id);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

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

  useEffect(() => {
    if (!profile.id) return;
    // Listen for any running stream for this user
    const unsub = onSnapshot(
      query(collection(db, 'streams'), where('userId', '==', profile.id), where('status', '==', 'live')),
      (snapshot) => {
        setHasUnfinishedStream(!snapshot.empty);
      }
    );
    return () => unsub();
  }, [profile.id, showLiveStreamPopup]);


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
          const hasValidSubscription = querySnapshot.docs.some(doc => {
            const data = doc.data();
            const isActive = data.status === 'active';
            const isCancelledButValid = data.status === 'cancelled' && 
              data.endDate && 
              data.endDate.toDate() > now;
            return isActive || isCancelledButValid;
          });
          setIsSubscribed(hasValidSubscription);
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

  const handleMessageClick = async () => {
    if (profile?.uid) {
      await openChat(profile);
    } else {
      console.error('Profile missing uid:', profile);
    }
  };

  const handleEndStream = async () => {
    if (!currentStreamId) return;

    try {
      // Update the stream status
      await updateDoc(doc(db, 'streams', currentStreamId), {
        status: 'ended',
        endedAt: new Date(),
        updatedAt: new Date()
      });

      // Update the associated post status directly by ID
      await updateDoc(doc(db, 'posts', currentStreamId), {
        status: 'ended',
        updatedAt: new Date()
      });

      setShowLiveStreamPopup(false);
      setCurrentStreamId(null);
    } catch (error) {
      alert('Failed to end stream. Please try again.');
      console.error('Error ending stream:', error);
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
            <div className="text-left">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                {profile.displayName || profile.username}
                <span className="text-sm text-gray-500">@{profile.username}</span>
              </h1>
            </div>

            {/* Action Buttons - Fixed Position */}
            <div className="inline-flex flex-wrap gap-3">
              {isOwnProfile && (
              <>
                  <button
                  className="profile-btn go-live"
                    onClick={() => setShowLiveDialog(true)}
                  style={{
                    border: 'none',
                    color: '#fff',
                    backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                    backgroundColor: 'transparent',
                    borderRadius: '20px',
                    backgroundSize: '100% auto',
                    fontFamily: 'inherit',
                    fontSize: '11px',
                    padding: '0.3em 0.6em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.3s ease-in-out',
                    boxShadow: 'none',
                    margin: '0',
                    width: 'auto',
                    height: 'auto',
                    minWidth: 'auto',
                    minHeight: 'auto',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    flexShrink: '0',
                    textDecoration: 'none',
                    fontWeight: 'normal',
                    textTransform: 'none',
                    letterSpacing: 'normal',
                    whiteSpace: 'nowrap',
                    verticalAlign: 'middle',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none',
                    backgroundOrigin: 'padding-box',
                    backgroundClip: 'padding-box',
                    position: 'relative'
                  }}
                >
                  <span>GO LIVE</span>
                  </button>
                  {profile.bio ? (
                    <button
                    className="profile-btn edit-bio"
                      onClick={() => setEditingBio(true)}
                    style={{
                      border: 'none',
                      color: '#fff',
                      backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                      backgroundColor: 'transparent',
                      borderRadius: '20px',
                      backgroundSize: '100% auto',
                      fontFamily: 'inherit',
                      fontSize: '11px',
                      padding: '0.3em 0.6em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.3s ease-in-out',
                      boxShadow: 'none',
                      margin: '0',
                      width: 'auto',
                      height: 'auto',
                      minWidth: 'auto',
                      minHeight: 'auto',
                      maxWidth: 'none',
                      maxHeight: 'none',
                      flexShrink: '0',
                      textDecoration: 'none',
                      fontWeight: 'normal',
                      textTransform: 'none',
                      letterSpacing: 'normal',
                      whiteSpace: 'nowrap',
                      verticalAlign: 'middle',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      appearance: 'none',
                      backgroundOrigin: 'padding-box',
                      backgroundClip: 'padding-box',
                      position: 'relative'
                    }}
                  >
                    <span>EDIT BIO</span>
                    </button>
                  ) : (
                    <button
                    className="profile-btn edit-bio"
                      onClick={() => setEditingBio(true)}
                    style={{
                      border: 'none',
                      color: '#fff',
                      backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                      backgroundColor: 'transparent',
                      borderRadius: '20px',
                      backgroundSize: '100% auto',
                      fontFamily: 'inherit',
                      fontSize: '11px',
                      padding: '0.3em 0.6em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.3s ease-in-out',
                      boxShadow: 'none',
                      margin: '0',
                      width: 'auto',
                      height: 'auto',
                      minWidth: 'auto',
                      minHeight: 'auto',
                      maxWidth: 'none',
                      maxHeight: 'none',
                      flexShrink: '0',
                      textDecoration: 'none',
                      fontWeight: 'normal',
                      textTransform: 'none',
                      letterSpacing: 'normal',
                      whiteSpace: 'nowrap',
                      verticalAlign: 'middle',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      appearance: 'none',
                      backgroundOrigin: 'padding-box',
                      backgroundClip: 'padding-box',
                      position: 'relative'
                    }}
                  >
                    <span>ADD BIO</span>
                    </button>
                  )}
              </>
            )}
            
            <button
              onClick={handleShare}
              className="profile-btn share"
              style={{
                border: 'none',
                color: '#fff',
                backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                backgroundColor: 'transparent',
                borderRadius: '20px',
                backgroundSize: '100% auto',
                fontFamily: 'inherit',
                fontSize: '11px',
                padding: '0.3em 0.6em',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.3s ease-in-out',
                boxShadow: 'none',
                margin: '0',
                width: 'auto',
                height: 'auto',
                minWidth: 'auto',
                minHeight: 'auto',
                maxWidth: 'none',
                maxHeight: 'none',
                flexShrink: '0',
                textDecoration: 'none',
                fontWeight: 'normal',
                textTransform: 'none',
                letterSpacing: 'normal',
                whiteSpace: 'nowrap',
                verticalAlign: 'middle',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none',
                backgroundOrigin: 'padding-box',
                backgroundClip: 'padding-box',
                position: 'relative'
              }}
            >
              <Share2 size={16} />
              <span>SHARE</span>
            </button>
            
            {!isOwnProfile && (
              <>
                <button
                  onClick={handleMessageClick}
                  className="profile-btn chat"
                  style={{
                    border: 'none',
                    color: '#fff',
                    backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                    backgroundColor: 'transparent',
                    borderRadius: '20px',
                    backgroundSize: '100% auto',
                    fontFamily: 'inherit',
                    fontSize: '11px',
                    padding: '0.3em 0.6em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.3s ease-in-out',
                    boxShadow: 'none',
                    margin: '0',
                    width: 'auto',
                    height: 'auto',
                    minWidth: 'auto',
                    minHeight: 'auto',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    flexShrink: '0',
                    textDecoration: 'none',
                    fontWeight: 'normal',
                    textTransform: 'none',
                    letterSpacing: 'normal',
                    whiteSpace: 'nowrap',
                    verticalAlign: 'middle',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none',
                    backgroundOrigin: 'padding-box',
                    backgroundClip: 'padding-box',
                    position: 'relative'
                  }}
                >
                  <HiOutlineChatBubbleLeftRight size={16} />
                  <span>CHAT</span>
                </button>
                <FollowButton
                  userId={profile.id}
                  className="profile-btn follow"
                />
                <button
                  onClick={() => setShowPlansModal(true)}
                  disabled={checkingSubscription || isSubscribed}
                  className="profile-btn subscribe"
                  style={{
                    border: 'none',
                    color: '#fff',
                    backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                    backgroundColor: 'transparent',
                    borderRadius: '20px',
                    backgroundSize: '100% auto',
                    fontFamily: 'inherit',
                    fontSize: '11px',
                    padding: '0.3em 0.6em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.3s ease-in-out',
                    boxShadow: 'none',
                    margin: '0',
                    width: 'auto',
                    height: 'auto',
                    minWidth: 'auto',
                    minHeight: 'auto',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    flexShrink: '0',
                    textDecoration: 'none',
                    fontWeight: 'normal',
                    textTransform: 'none',
                    letterSpacing: 'normal',
                    whiteSpace: 'nowrap',
                    verticalAlign: 'middle',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none',
                    backgroundOrigin: 'padding-box',
                    backgroundClip: 'padding-box',
                    position: 'relative'
                  }}
                >
                  <span>SUBSCRIBE</span>
                </button>
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
                  minHeight: '150px !important',
                  height: 'auto !important',
                  maxHeight: 'none !important',
                  resize: 'vertical !important'
                } as React.CSSProperties}
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
                      className="whitespace-pre-line block text-gray-600 text-sm sm:text-base"
                      style={isClamped ? {
                        display: 'block',
                        maxHeight: '4.5rem', // 3 lines worth of height
                        overflow: 'hidden',
                        position: 'relative',
                      } : {}}
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
                    
                    {/* Social Links inside bio section */}
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
      <div className="flex justify-center mt-4 mb-4 px-4 sm:px-6">
        <div className="tab-container">
          <input 
            type="radio" 
            name="tab" 
            id="tab1" 
            className="tab tab--1" 
            checked={activeTab === 'feed'}
            onChange={() => handleTabClick('feed')}
          />
          <label className="tab_label" htmlFor="tab1">Feed</label>

          <input 
            type="radio" 
            name="tab" 
            id="tab2" 
            className="tab tab--2" 
            checked={activeTab === 'pictures'}
            onChange={() => handleTabClick('pictures')}
          />
          <label className="tab_label" htmlFor="tab2">Pics</label>

          <input 
            type="radio" 
            name="tab" 
            id="tab3" 
            className="tab tab--3" 
            checked={activeTab === 'videos'}
            onChange={() => handleTabClick('videos')}
          />
          <label className="tab_label" htmlFor="tab3">Videos</label>

          <input 
            type="radio" 
            name="tab" 
            id="tab4" 
            className="tab tab--4" 
            checked={activeTab === 'videos360'}
            onChange={() => handleTabClick('videos360')}
          />
          <label className="tab_label" htmlFor="tab4">360°</label>

          <input 
            type="radio" 
            name="tab" 
            id="tab5" 
            className="tab tab--5" 
            checked={activeTab === 'vrvideos'}
            onChange={() => handleTabClick('vrvideos')}
          />
          <label className="tab_label" htmlFor="tab5">VR</label>

          <div className="indicator"></div>
        </div>
      </div>
      <LiveStreamDialog
        isOpen={showLiveDialog}
        onClose={() => setShowLiveDialog(false)}
        onStreamStart={(streamId) => {
          setShowLiveDialog(false);
          router.push(`/streamer/${streamId}`);
        }}
      />
    </div>
  );
} 