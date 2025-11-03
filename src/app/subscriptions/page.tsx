'use client';

import React, { useEffect, useState } from 'react';
import { CreatorCard } from '@/components/user/CreatorCard';
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { UserSubscription } from '../../types/subscription';
import { CreatorProfile } from '@/types/user';
import { CompactPost } from '@/components/posts/CompactPost';
import { Post as PostType } from '@/lib/types/post';
import { Badge } from '@/components/ui/badge';
import { UserCard } from '@/components/user/UserCard';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import PlansModal from '@/components/creator/PlansModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Subscriptions tabs styles for mobile
const subscriptionsTabsStyles = `
  .subscriptions-tabs-container {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .subscriptions-tabs {
    display: flex;
    position: relative;
    background-color: #fff;
    box-shadow: 0 0 1px 0 rgba(24, 94, 224, 0.15), 0 6px 12px 0 rgba(24, 94, 224, 0.15);
    padding: 0.25rem;
    border-radius: 99px;
    gap: 0.5rem;
  }

  .subscriptions-tabs * {
    z-index: 2;
  }

  .subscriptions-tabs-container input[type="radio"] {
    display: none;
  }

  .subscriptions-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 30px;
    flex: 1;
    min-width: 80px;
    padding: 0 12px;
    font-size: 0.8rem;
    color: black;
    font-weight: 500;
    border-radius: 99px;
    cursor: pointer;
    transition: color 0.15s ease-in;
    position: relative;
  }

  .subscriptions-notification {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0.8rem;
    height: 0.8rem;
    padding: 0 4px;
    position: absolute;
    top: -2px;
    right: 4px;
    font-size: 10px;
    border-radius: 50%;
    background-color: #e6eef9;
    color: #000;
    transition: 0.15s ease-in;
  }

  .subscriptions-tabs-container input[type="radio"]:checked + .subscriptions-tab {
    color: #185ee0;
  }

  .subscriptions-tabs-container input[type="radio"]:checked + .subscriptions-tab > .subscriptions-notification {
    background-color: #185ee0;
    color: #fff;
  }

  .subscriptions-tabs-container input[id="radio-1"]:checked ~ .subscriptions-glider {
    transform: translateX(0);
  }

  .subscriptions-tabs-container input[id="radio-2"]:checked ~ .subscriptions-glider {
    transform: translateX(calc(100% + 0.5rem));
  }

  .subscriptions-glider {
    position: absolute;
    display: flex;
    height: 30px;
    width: calc(50% - 0.625rem);
    background-color: #e6eef9;
    z-index: 1;
    border-radius: 99px;
    transition: 0.25s ease-out;
    left: 0.25rem;
  }
`;

interface UserList {
  name: string;
  count: number;
  users: CreatorProfile[];
}

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const subscriptions = useSubscriptions();
  
  // Use context state for tabs (shared with MainLayout header)
  const userLists = subscriptions.userLists;
  const setUserLists = subscriptions.setUserLists;
  const selectedList = subscriptions.selectedList;
  const setSelectedList = subscriptions.setSelectedList;
  const [tab, setTab] = useState('userlists');
  const [userFilter, setUserFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<CreatorProfile | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [postTypeFilter, setPostTypeFilter] = useState('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showExpiredNote, setShowExpiredNote] = useState(true);
  const { searchQuery, setSearchQuery } = useSubscriptions();
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewCreatorId, setRenewCreatorId] = useState<string | null>(null);
  const [renewPlans, setRenewPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [cancelingSubscription, setCancelingSubscription] = useState<string | null>(null);
  const [showCancelConfirmDialog, setShowCancelConfirmDialog] = useState(false);
  const [cancelConfirmCreatorId, setCancelConfirmCreatorId] = useState<string | null>(null);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  const [showSubscriptionsModal, setShowSubscriptionsModal] = useState(false);
  const [subscriptionsModalCreatorId, setSubscriptionsModalCreatorId] = useState<string | null>(null);
  const [subscriptionsModalPlans, setSubscriptionsModalPlans] = useState<any[]>([]);
  const [subscriptionsModalPlansLoading, setSubscriptionsModalPlansLoading] = useState(false);

  // Handle deleting expired creator from list
  const handleDeleteExpiredCreator = (creatorUid: string) => {
    // Remove from the Expired list
    setUserLists(prevLists => {
      return prevLists.map(list => {
        if (list.name === 'Expired') {
          const updatedUsers = list.users.filter(u => u.uid !== creatorUid);
          return {
            ...list,
            users: updatedUsers,
            count: updatedUsers.length
          };
        }
        return list;
      });
    });

    // If the deleted creator was selected, clear selection
    if (selectedUser?.uid === creatorUid) {
      setSelectedUser(null);
      setPosts([]);
    }
    
    // Close confirmation dropdown
    setShowDeleteConfirm(null);
  };

  // Handle opening subscriptions modal
  const handleOpenSubscriptions = async (creatorUid: string) => {
    setSubscriptionsModalCreatorId(creatorUid);
    setSubscriptionsModalPlansLoading(true);
    try {
      const q = query(
        collection(db, 'plans'),
        where('creatorId', '==', creatorUid)
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
          creatorId: data.creatorId || creatorUid
        };
      });
      setSubscriptionsModalPlans(plansData);
      setShowSubscriptionsModal(true);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setSubscriptionsModalPlans([]);
      setShowSubscriptionsModal(true);
    } finally {
      setSubscriptionsModalPlansLoading(false);
    }
  };

  // Actually cancel subscription after confirmation
  const confirmCancelSubscription = async () => {
    if (!user?.uid || !cancelConfirmCreatorId) return;

    setShowCancelConfirmDialog(false);
    const creatorUid = cancelConfirmCreatorId;
    setCancelConfirmCreatorId(null);

    setCancelingSubscription(creatorUid);
    try {
      // Find and update subscription in Firestore
      const subscriptionQuery = query(
        collection(db, 'subscriptions'),
        where('subscriberId', '==', user.uid),
        where('creatorId', '==', creatorUid),
        where('status', '==', 'active')
      );
      const querySnapshot = await getDocs(subscriptionQuery);
      
      if (querySnapshot.empty) {
        console.error('No active subscription found');
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
          const duration = planData.duration || 30;
          const startDate = subscriptionData.startDate?.toDate ? subscriptionData.startDate.toDate() : new Date(subscriptionData.startDate || Date.now());
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + duration);
        } else {
          const startDate = subscriptionData.startDate?.toDate ? subscriptionData.startDate.toDate() : new Date(subscriptionData.startDate || Date.now());
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 30);
        }
      } else {
        endDate = endDate.toDate ? endDate.toDate() : new Date(endDate);
      }

      // Convert to Timestamp
      const endDateTimestamp = Timestamp.fromDate(endDate);
      const cancelledAtTimestamp = Timestamp.now();

      // Update subscription to cancelled
      await updateDoc(subscriptionDoc.ref, {
        status: 'cancelled',
        cancelledAt: cancelledAtTimestamp,
        endDate: endDateTimestamp,
        willRenew: false,
        updatedAt: cancelledAtTimestamp
      });

      // Move creator from Subscribed to Expired list
      setUserLists(prevLists => {
        const subscribedList = prevLists.find(l => l.name === 'Subscribed');
        const expiredList = prevLists.find(l => l.name === 'Expired');
        const creator = subscribedList?.users.find(u => u.uid === creatorUid);
        
        if (creator) {
          const updatedSubscribed = subscribedList ? subscribedList.users.filter(u => u.uid !== creatorUid) : [];
          const updatedExpired = expiredList ? [...expiredList.users, creator] : [creator];
          
          return prevLists.map(list => {
            if (list.name === 'Subscribed') {
              return { ...list, users: updatedSubscribed, count: updatedSubscribed.length };
            }
            if (list.name === 'Expired') {
              return { ...list, users: updatedExpired, count: updatedExpired.length };
            }
            return list;
          });
        }
        return prevLists;
      });

      // Refresh the page to update subscription status
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('Failed to cancel subscription');
    } finally {
      setCancelingSubscription(null);
    }
  };

  // Backend logic - keep all existing useEffect hooks and functions
  useEffect(() => {
    async function fetchUserLists() {
      if (!user) return;

      
      // Fetch subscriptions
      const subscriptionsQuery = query(
        collection(db, 'subscriptions'),
        where('subscriberId', '==', user.uid),
        where('status', 'in', ['active', 'cancelled'])
      );
      const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
      const now = new Date();
      const subscribedUsers: CreatorProfile[] = [];
      const expiredUsers: CreatorProfile[] = [];
      
      // Group subscriptions by creatorId to get the most recent one per creator
      const subscriptionsByCreator = new Map<string, any>();
      
      for (const subDoc of subscriptionsSnapshot.docs) {
        const sub = subDoc.data();
        const creatorId = sub.creatorId;
        
        if (!subscriptionsByCreator.has(creatorId)) {
          subscriptionsByCreator.set(creatorId, subDoc);
        } else {
          // Compare dates to find the most recent subscription
          const existing = subscriptionsByCreator.get(creatorId)!.data();
          const existingDate = existing.startDate?.toDate ? existing.startDate.toDate() : new Date(existing.startDate || 0);
          const currentDate = sub.startDate?.toDate ? sub.startDate.toDate() : new Date(sub.startDate || 0);
          
          if (currentDate.getTime() > existingDate.getTime()) {
            subscriptionsByCreator.set(creatorId, subDoc);
          }
        }
      }
      
      // Now process each creator's most recent subscription
      // Track which creators we've already processed
      const processedCreatorIds = new Set<string>();
      
      for (const [, subDoc] of subscriptionsByCreator) {
        const sub = subDoc.data();
        const creatorId = sub.creatorId;
        
        // Skip if we've already processed this creator
        if (processedCreatorIds.has(creatorId)) {
          continue;
        }
        
        processedCreatorIds.add(creatorId);
        
        const creatorRef = doc(db, 'users', creatorId);
        const creatorSnap = await getDoc(creatorRef);
        if (!creatorSnap.exists()) continue;
        const creator = { uid: creatorSnap.id, ...creatorSnap.data() } as CreatorProfile;
        
        // Check if subscription is active or cancelled but still valid
        const isActive = sub.status === 'active';
        const isCancelledButValid = sub.status === 'cancelled' && 
          sub.endDate && 
          (sub.endDate.toDate ? sub.endDate.toDate() : new Date(sub.endDate)) > now;
        
        // Only add to ONE list - Subscribed OR Expired, never both
        if (isActive || isCancelledButValid) {
          subscribedUsers.push(creator);
          console.log(`✅ Creator ${creator.uid} added to Subscribed (active: ${isActive}, cancelledButValid: ${isCancelledButValid})`);
        } else {
          expiredUsers.push(creator);
          console.log(`❌ Creator ${creator.uid} added to Expired (status: ${sub.status}, endDate: ${sub.endDate ? (sub.endDate.toDate ? sub.endDate.toDate().toISOString() : new Date(sub.endDate).toISOString()) : 'none'})`);
        }
      }

      setUserLists([
        { name: 'Subscribed', count: subscribedUsers.length, users: subscribedUsers },
        { name: 'Expired', count: expiredUsers.length, users: expiredUsers },
      ]);
      
      // If selected user is in wrong list, clear selection or move to correct list
      if (selectedUser) {
        const isInSubscribed = subscribedUsers.find(u => u.uid === selectedUser.uid);
        const isInExpired = expiredUsers.find(u => u.uid === selectedUser.uid);
        
        // If selected user has active subscription but is in Expired tab, clear selection
        if (isInSubscribed && selectedList === 'Expired') {
          console.log(`⚠️ Clearing selection: User ${selectedUser.uid} has active subscription but is in Expired tab`);
          setSelectedUser(null);
          setPosts([]);
        }
        // If selected user is expired but is in Subscribed tab, clear selection
        else if (isInExpired && selectedList === 'Subscribed') {
          console.log(`⚠️ Clearing selection: User ${selectedUser.uid} is expired but is in Subscribed tab`);
          setSelectedUser(null);
          setPosts([]);
        }
      }
      
      // Default select first user if none selected
      if (selectedList === 'Subscribed' && subscribedUsers.length > 0 && !selectedUser) {
        setSelectedUser(subscribedUsers[0]);
      } else if (selectedList === 'Expired' && expiredUsers.length > 0 && !selectedUser) {
        setSelectedUser(expiredUsers[0]);
      }
    }
    fetchUserLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    async function fetchPosts() {
      if (!selectedUser || !selectedUser.uid) {
        setPosts([]);
        return;
      }
      
      
      // Check if user has active subscription by querying Firestore directly
      // Don't rely on selectedList because creator might be in wrong tab
      let hasActiveSubscription = false;
      try {
        const subscriptionQuery = query(
          collection(db, 'subscriptions'),
          where('subscriberId', '==', user.uid),
          where('creatorId', '==', selectedUser.uid),
          where('status', 'in', ['active', 'cancelled'])
        );
        const subscriptionSnapshot = await getDocs(subscriptionQuery);
        
        if (!subscriptionSnapshot.empty) {
          const now = new Date();
          // Check if any subscription is active or cancelled but still valid
          hasActiveSubscription = subscriptionSnapshot.docs.some(subDoc => {
            const sub = subDoc.data();
            const isActive = sub.status === 'active';
            const isCancelledButValid = sub.status === 'cancelled' && 
              sub.endDate && 
              (sub.endDate.toDate ? sub.endDate.toDate() : new Date(sub.endDate)) > now;
            return isActive || isCancelledButValid;
          });
        }
      } catch (error) {
        console.error('Error checking subscription status for posts:', error);
      }
      
      // Real data fetching
      try {
        const postsQuery = query(
          collection(db, 'posts'),
          where('authorId', '==', selectedUser.uid)
        );
        const postsSnapshot = await getDocs(postsQuery);
        const postsList: PostType[] = await Promise.all(postsSnapshot.docs.map(async docSnap => {
          const postData = docSnap.data();
          // Fetch author data
          const authorId = postData.authorId || postData.userId;
          if (!authorId) {
            console.error(`No author ID found for post ${docSnap.id}`);
            return null;
          }
          const authorRef = doc(db, 'users', authorId);
          const authorSnap = await getDoc(authorRef);
          let author = null;
          if (authorSnap.exists()) {
            const data = authorSnap.data();
            author = {
              id: authorSnap.id,
              uid: authorSnap.id,
              displayName: data.displayName || '',
              email: data.email || '',
              photoURL: data.photoURL || '/default-avatar.png',
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
              role: data.role || 'user',
              bio: data.bio || '',
              website: data.website || '',
              location: data.location || '',
              followers: Array.isArray(data.followers) ? data.followers : [],
              following: Array.isArray(data.following) ? data.following : [],
              username: data.username || '',
              isVerified: !!data.isVerified
            };
          }
          return { ...postData, id: docSnap.id, author } as any;
        }));
        
        // Filter posts based on subscription status
        let filteredPosts = postsList.filter(post => post !== null);
        
        // If viewing Expired tab, ALWAYS show only free/public posts (creator shouldn't be here if has active subscription)
        // But add safety check: if user has active subscription, they shouldn't be in Expired tab at all
        if (selectedList === 'Expired') {
          // If somehow user has active subscription but is viewing Expired tab, don't show any posts
          // (they should be viewing from Subscribed tab)
          if (hasActiveSubscription) {
            filteredPosts = [];
          } else {
            // Normal case: show only free/public posts
            filteredPosts = filteredPosts.filter(post => {
              // Allow free/public posts
              if (post.isPublic) return true;
              
              // Get access level
              const accessLevel = (post as any).accessSettings?.accessLevel as string | undefined;
              
              // Only show free content when subscription expired
              if (!accessLevel || accessLevel === 'free') return true;
              
              // Hide all locked/premium content
              return false;
            });
          }
        }
        
        setPosts(filteredPosts);
      } catch (error) {
        console.error('Error fetching posts:', error);
        setPosts([]);
      }
    }
    fetchPosts();
  }, [selectedUser, selectedList, user]);

  // Refetch subscriptions (for use after cancellation)
  const refetchSubscriptions = async () => {
    if (!user) return;
    try {
      const subscriptionsQuery = query(
        collection(db, 'subscriptions'),
        where('subscriberId', '==', user.uid),
        where('status', 'in', ['active', 'cancelled'])
      );
      const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
      const now = new Date();
      // Only include active or cancelled-but-not-expired subscriptions
      const validSubscriptions = subscriptionsSnapshot.docs
        .map(doc => doc.data())
        .filter(sub =>
          sub.status === 'active' ||
          (sub.status === 'cancelled' && sub.endDate &&
            (sub.endDate.toDate ? sub.endDate.toDate() : new Date(sub.endDate)) > now)
        );
      const creatorIds = validSubscriptions.map(sub => sub.creatorId);
      const creators: CreatorProfile[] = [];
      for (const creatorId of creatorIds) {
        const userRef = doc(db, 'users', creatorId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          creators.push({ uid: userSnap.id, ...userSnap.data() } as CreatorProfile);
        }
      }
      setUserLists(prevLists => {
        // Remove any existing 'Subscribed' list
        const filtered = prevLists.filter(l => l.name !== 'Subscribed');
        // Add the new 'Subscribed' list at the end
        return [
          ...filtered,
          { name: 'Subscribed', count: creators.length, users: creators }
        ];
      });
      // If the selected user is no longer in the list, clear selection
      if (selectedUser && !creators.some(c => c.uid === selectedUser.uid)) {
        setSelectedUser(creators[0] || null);
      }
    } catch (error) {
      console.error('Error refetching subscriptions:', error);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: subscriptionsTabsStyles }} />
      <div 
        className={`flex flex-col bg-white rounded-lg shadow-sm scrollbar-hide ${
          isMobile ? '' : 'overflow-hidden'
        }`} 
        style={{
          height: isMobile ? 'calc(100vh - 104px)' : '74vh', // 48px header + 56px bottom nav
          marginTop: isMobile ? '0' : '-30px', 
          position: 'relative', 
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          overflow: isMobile ? 'visible' : 'hidden',
          maxHeight: isMobile ? 'calc(100vh - 104px)' : '74vh',
        }}
      >
      {/* Top Header - Radio Buttons spanning both columns - Fixed/Sticky on mobile */}
      {isMobile && (
        <div className="flex flex-col flex-shrink-0 bg-white border-b border-gray-200">
          {/* Tabs Row */}
          <div 
            className="px-2 py-1.5 flex items-center justify-center flex-shrink-0 bg-white" 
            style={{
              minHeight: '44px',
              position: 'sticky',
              top: '50px', // Below search bar on mobile
              zIndex: 10,
            }}
          >
            <div className="subscriptions-tabs-container">
              <div className="subscriptions-tabs">
                {userLists.map((list, index) => (
                  <React.Fragment key={list.name}>
                    <input 
                      type="radio" 
                      name="subscriptionStatus" 
                      id={`radio-${index + 1}`}
                      checked={selectedList === list.name}
                      onChange={() => {
                        setSelectedList(list.name);
                        // Reset selected user when switching tabs on mobile
                        setSelectedUser(null);
                        // Reset expired note visibility when switching tabs
                        if (list.name === 'Expired') {
                          setShowExpiredNote(true);
                        }
                      }}
                    />
                    <label className="subscriptions-tab" htmlFor={`radio-${index + 1}`}>
                      {list.name}
                      {list.count > 0 && (
                        <span className="subscriptions-notification">{list.count}</span>
                      )}
                    </label>
                  </React.Fragment>
                ))}
                <span className="subscriptions-glider"></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile: Stacked Layout, Desktop: Two Columns */}
      <div 
        className={`flex-1 ${isMobile ? 'flex-col' : 'flex-row overflow-hidden'} scrollbar-hide`}
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0, // Critical for flex scrolling
          overflow: isMobile ? 'visible' : 'hidden',
        }}
      >
            {/* Left Column - Creator List */}
        <div 
          className={`${isMobile ? 'w-full' : 'w-80'} flex flex-col bg-white ${isMobile ? 'border-b' : 'border-r'} border-gray-200 ${isMobile && selectedUser ? 'hidden' : ''}`}
          style={{
            display: isMobile && selectedUser ? 'none' : 'flex',
            flexDirection: 'column',
            minHeight: 0, // Critical for flex scrolling
          }}
        >
              {/* Column Title */}
          <div className={`${isMobile ? 'px-3' : 'px-4'} py-2 border-b border-gray-200 flex-shrink-0 flex items-center justify-between bg-white`}>
            <h2 className={`${isMobile ? 'text-sm' : 'text-base'} font-bold text-gray-800`}>Creators</h2>
            {isMobile && (
              <span className="text-xs text-gray-500">
                {userLists.find(list => list.name === selectedList)?.count || 0}
              </span>
            )}
              </div>
              
              {/* Creators List */}
          <div 
            className={`flex-1 overflow-y-auto scrollbar-hide space-y-2 ${isMobile ? 'pt-3 px-3 pb-20' : 'pt-6 px-4'}`}
            style={{ 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              minHeight: 0, // Critical for flex scrolling
              WebkitOverflowScrolling: 'touch',
              overflowY: 'auto',
              maxHeight: isMobile ? 'calc(100vh - 250px)' : 'none', // Account for search bar + tabs
            }}
          >
          {(() => {
              let users = userLists.find(list => list.name === selectedList)?.users || [];
            const seen = new Set();
              let uniqueUsers = users.filter(u => {
              if (!u.uid) {
                console.warn('[DEBUG] Creator missing uid:', u);
                return false;
              }
              if (seen.has(u.uid)) {
                console.warn('[DEBUG] Duplicate creator uid:', u.uid);
                return false;
              }
              seen.add(u.uid);
              return true;
            });

              // Filter by search query on mobile
              if (isMobile && searchQuery.trim()) {
                const queryLower = searchQuery.toLowerCase().trim();
                uniqueUsers = uniqueUsers.filter(creator => {
                  const username = (creator.username || '').toLowerCase();
                  const displayName = (creator.displayName || '').toLowerCase();
                  return username.includes(queryLower) || displayName.includes(queryLower);
                });
              }
              
              if (uniqueUsers.length === 0) {
                return (
                  <div className={`text-center text-gray-500 ${isMobile ? 'text-xs py-6' : 'text-sm py-8'}`}>
                    {isMobile && searchQuery.trim() 
                      ? `No creators found matching "${searchQuery}"`
                      : `No ${selectedList.toLowerCase()} creators yet.`
                    }
                  </div>
                );
              }
              
            return uniqueUsers.map((creator) => {
              const isDropdownOpen = openDropdowns.has(creator.uid);
              return (
              <div
                key={creator.uid}
                  className={`relative cursor-pointer transition-all duration-200 group ${
                    selectedUser?.uid === creator.uid 
                      ? 'opacity-100 scale-[1.02]' 
                      : 'opacity-70 hover:opacity-85'
                  }`}
                onClick={() => setSelectedUser(creator)}
              >
                <CreatorCard
                  userId={creator.uid}
                  username={creator.username}
                  displayName={creator.displayName}
                  photoURL={creator.photoURL}
                  coverPhotoUrl={creator.coverPhotoUrl}
                />
                  {(selectedList === 'Subscribed' || selectedList === 'Expired') && (
                    <div className={`absolute top-2 right-2 z-10 ${isMobile ? 'opacity-100' : isDropdownOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-all`}>
                      <DropdownMenu 
                        open={isDropdownOpen} 
                        onOpenChange={(open) => {
                          setOpenDropdowns(prev => {
                            const newSet = new Set(prev);
                            if (open) {
                              newSet.add(creator.uid);
                            } else {
                              newSet.delete(creator.uid);
                            }
                            return newSet;
                          });
                        }}
                      >
                        <DropdownMenuTrigger asChild>
                    <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 bg-white hover:bg-gray-100 text-gray-700 rounded-full shadow-lg transition-colors border border-gray-200"
                            title="More options"
                            disabled={cancelingSubscription === creator.uid}
                          >
                            {cancelingSubscription === creator.uid ? (
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-700"></div>
                            ) : (
                              <MoreVertical className="h-3.5 w-3.5" />
                            )}
                    </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end" 
                          className="w-40 bg-white border-0 overflow-hidden p-0"
                        style={{
                          borderRadius: '12px',
                          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                          {selectedList === 'Subscribed' && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSubscriptions(creator.uid);
                              }}
                              className="cursor-pointer text-xs py-2.5 px-3 hover:bg-gray-100 transition-all duration-200"
                              style={{
                                fontWeight: '500',
                                color: '#374151',
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Subscriptions
                            </DropdownMenuItem>
                          )}
                          {selectedList === 'Expired' && (
                            <>
                              <DropdownMenuItem
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setRenewCreatorId(creator.uid);
                                  setPlansLoading(true);
                                  try {
                                    const q = query(
                                      collection(db, 'plans'),
                                      where('creatorId', '==', creator.uid)
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
                                        creatorId: data.creatorId || creator.uid
                                      };
                                    });
                                    setRenewPlans(plansData);
                                    setShowRenewModal(true);
                                  } catch (err) {
                                    console.error('Error fetching plans:', err);
                                    setRenewPlans([]);
                                    setShowRenewModal(true);
                                  } finally {
                                    setPlansLoading(false);
                                  }
                                }}
                                className="cursor-pointer text-xs py-2.5 px-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 border-b border-gray-100"
                                style={{
                                  fontWeight: '500',
                                  color: '#2563eb',
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Renew Subscription
                              </DropdownMenuItem>
                              <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteExpiredCreator(creator.uid);
                          }}
                                className="cursor-pointer text-xs py-2.5 px-3 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 transition-all duration-200"
                                style={{
                                  fontWeight: '500',
                                  color: '#dc2626',
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Remove from list
                              </DropdownMenuItem>
                            </>
                    )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                  </div>
                )}
              </div>
              );
            });
          })()}
        </div>
        </div>

            {/* Right Column - Posts */}
        <div 
          className={`flex-1 flex flex-col bg-white ${isMobile && !selectedUser ? 'hidden' : ''}`}
          style={{
            display: isMobile && !selectedUser ? 'none' : 'flex',
            flexDirection: 'column',
            minHeight: 0, // Critical for flex scrolling
          }}
        >
          {/* Column Title - Hide on mobile when no selection */}
          {(!isMobile || selectedUser) && (
            <div className={`${isMobile ? 'px-3' : 'px-4'} py-2 border-b border-gray-200 flex-shrink-0 flex items-center justify-between bg-white`}>
              <h2 className={`${isMobile ? 'text-sm' : 'text-base'} font-bold text-gray-800 truncate flex-1`}>
                {selectedUser ? `${selectedUser.displayName || selectedUser.username}'s Posts` : 'Posts'}
              </h2>
              {isMobile && selectedUser && (
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium ml-2 flex-shrink-0"
                >
                  ← Back
                </button>
              )}
              </div>
          )}

              {/* Posts Content */}
          <div 
            className={`flex-1 overflow-y-auto scrollbar-hide ${isMobile ? 'p-3 pb-20' : 'p-6'}`}
            style={{ 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              minHeight: 0, // Critical for flex scrolling
              WebkitOverflowScrolling: 'touch',
              overflowY: 'auto',
              maxHeight: isMobile ? 'calc(100vh - 250px)' : 'none', // Account for search bar + tabs
            }}
          >
          {selectedUser ? (
            posts.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-8 px-4">
                  {selectedList === 'Expired' ? (
                    <div className="space-y-2">
                      <p className="font-medium">Subscription Expired</p>
                      <p className="text-xs text-gray-400">
                        Your subscription to {selectedUser.displayName || selectedUser.username} has expired. 
                        Subscribe again to view their premium content.
                      </p>
                    </div>
                  ) : (
                    'No posts found for this creator.'
                  )}
                </div>
              ) : (
                <div className={`space-y-3 ${isMobile ? 'space-y-4' : ''}`}>
                  {selectedList === 'Expired' && showExpiredNote && (
                    <div className="info mb-4" style={{
                      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
                      width: '100%',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'start',
                      background: '#509AF8',
                      borderRadius: '8px',
                      boxShadow: '0px 0px 5px -3px #111',
                    }}>
                      <div className="info__icon" style={{
                        width: '20px',
                        height: '20px',
                        transform: 'translateY(-2px)',
                        marginRight: '8px',
                        flexShrink: 0,
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" viewBox="0 0 24 24" height="20" fill="none">
                          <path fill="#fff" d="m12 1.5c-5.79844 0-10.5 4.70156-10.5 10.5 0 5.7984 4.70156 10.5 10.5 10.5 5.7984 0 10.5-4.7016 10.5-10.5 0-5.79844-4.7016-10.5-10.5-10.5zm.75 15.5625c0 .1031-.0844.1875-.1875.1875h-1.125c-.1031 0-.1875-.0844-.1875-.1875v-6.375c0-.1031.0844-.1875.1875-.1875h1.125c.1031 0 .1875.0844.1875.1875zm-.75-8.0625c-.2944-.00601-.5747-.12718-.7808-.3375-.206-.21032-.3215-.49305-.3215-.7875s.1155-.57718.3215-.7875c.2061-.21032.4864-.33149.7808-.3375.2944.00601.5747.12718.7808.3375.206.21032.3215.49305.3215.7875s-.1155.57718-.3215.7875c-.2061.21032-.4864.33149-.7808.3375z"></path>
                        </svg>
                      </div>
                      <div className="info__title" style={{
                        fontWeight: '500',
                        fontSize: isMobile ? '13px' : '14px',
                        color: '#fff',
                        flex: '1',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        Only free posts are shown. Subscribe again to view premium content.
                      </div>
                      <div 
                        className="info__close" 
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer',
                          marginLeft: 'auto',
                          flexShrink: 0,
                        }}
                        onClick={() => setShowExpiredNote(false)}
                      >
                        <svg height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
                          <path d="m15.8333 5.34166-1.175-1.175-4.6583 4.65834-4.65833-4.65834-1.175 1.175 4.65833 4.65834-4.65833 4.6583 1.175 1.175 4.65833-4.6583 4.6583 4.6583 1.175-1.175-4.6583-4.6583z" fill="#fff"></path>
                        </svg>
                      </div>
                    </div>
                  )}
                {posts.map((post, idx) => {
                  if (!post.id) {
                    console.warn('[DEBUG] Post missing id:', post);
                  }
                  return (
                    <CompactPost 
                      key={post.id || `post-idx-${idx}`}
                      post={post as any}
                      currentUserId={user?.uid}
                      onPostDeleted={(postId) => {
                        setPosts(prev => prev.filter(p => p.id !== postId));
                      }}
                    />
                  );
                })}
              </div>
            )
          ) : (
              <div className="text-gray-500 text-sm text-center py-8">
                {isMobile ? 'Tap a creator to view their posts' : 'Select a subscription to view their posts.'}
              </div>
          )}
        </div>
        </div>
      </div>
      
      {/* Renew Subscription Modal */}
      {renewCreatorId && (
        <PlansModal
          open={showRenewModal}
          onClose={() => {
            setShowRenewModal(false);
            setRenewCreatorId(null);
            setRenewPlans([]);
          }}
          creatorId={renewCreatorId}
          plans={renewPlans}
          onSelectPlan={() => {
            setShowRenewModal(false);
            setRenewCreatorId(null);
            setRenewPlans([]);
            // Refresh the user lists to move creator from Expired to Subscribed
            // This will be handled by the subscription system
            window.location.reload(); // Simple refresh, can be improved with state management
          }}
        />
      )}

      {/* Cancel Subscription Confirm Dialog */}
      <Dialog open={showCancelConfirmDialog} onOpenChange={setShowCancelConfirmDialog}>
        <DialogContent 
          className="sm:max-w-[320px] rounded-xl border-0 p-0 overflow-hidden"
          style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            boxShadow: `
              0 4px 20px rgba(0, 0, 0, 0.1),
              0 2px 8px rgba(0, 0, 0, 0.08),
              inset 0 1px 0 rgba(255, 255, 255, 0.9),
              inset 0 -1px 0 rgba(0, 0, 0, 0.05)
            `,
          }}
        >
          <DialogHeader className="space-y-2 px-4 pt-3 pb-2">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Cancel Subscription
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 leading-relaxed pb-1">
              Are you sure you want to cancel your subscription? You will keep access until the end of your paid period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-3 px-4 py-4 sm:flex-row sm:gap-2 sm:py-3 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelConfirmDialog(false);
                setCancelConfirmCreatorId(null);
              }}
              className="!rounded-xl !w-auto !px-6 !py-3 !text-sm !font-medium !transition-all !duration-200 !border !border-gray-300 !bg-white !text-gray-700 hover:!bg-gray-50 hover:!border-gray-400 active:!bg-gray-100 sm:!h-7 sm:!min-h-7 sm:!max-h-7 sm:!px-3 sm:!py-1.5 sm:!text-xs sm:!rounded-lg"
              style={{
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                minHeight: '48px',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget) {
                  e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget) {
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.transform = 'translateY(0px)';
                }
              }}
              onMouseDown={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget) {
                  e.currentTarget.style.transform = 'translateY(0px)';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
                }
              }}
              onMouseUp={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                }
              }}
              onTouchStart={(e) => {
                if (e.currentTarget) {
                  e.currentTarget.style.opacity = '0.8';
                }
              }}
              onTouchEnd={(e) => {
                const target = e.currentTarget;
                if (target) {
                  setTimeout(() => {
                    if (target) {
                      target.style.opacity = '1';
                    }
                  }, 150);
                }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={confirmCancelSubscription}
              disabled={cancelingSubscription !== null}
              className="!rounded-xl !w-auto !px-6 !py-3 !text-sm !font-medium !transition-all !duration-200 !border !border-gray-300 !bg-white !text-gray-700 hover:!bg-gray-50 hover:!border-gray-400 active:!bg-gray-100 disabled:!opacity-50 disabled:!cursor-not-allowed sm:!h-7 sm:!min-h-7 sm:!max-h-7 sm:!px-3 sm:!py-1.5 sm:!text-xs sm:!rounded-lg"
              style={{
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                minHeight: '48px',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget && !e.currentTarget.disabled) {
                  e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget) {
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.transform = 'translateY(0px)';
                }
              }}
              onMouseDown={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget && !e.currentTarget.disabled) {
                  e.currentTarget.style.transform = 'translateY(0px)';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
                }
              }}
              onMouseUp={(e) => {
                if (window.innerWidth >= 640 && e.currentTarget && !e.currentTarget.disabled) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                }
              }}
              onTouchStart={(e) => {
                if (e.currentTarget && !e.currentTarget.disabled) {
                  e.currentTarget.style.opacity = '0.8';
                }
              }}
              onTouchEnd={(e) => {
                const target = e.currentTarget;
                if (target) {
                  setTimeout(() => {
                    if (target) {
                      target.style.opacity = '1';
                    }
                  }, 150);
                }
              }}
            >
              {cancelingSubscription ? 'Cancelling...' : 'Cancel Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscriptions Modal for Subscribed tab */}
      {subscriptionsModalCreatorId && (
        <PlansModal
          open={showSubscriptionsModal}
          onClose={() => {
            setShowSubscriptionsModal(false);
            setSubscriptionsModalCreatorId(null);
            setSubscriptionsModalPlans([]);
          }}
          creatorId={subscriptionsModalCreatorId}
          plans={subscriptionsModalPlans}
          onSelectPlan={() => {
            setShowSubscriptionsModal(false);
            setSubscriptionsModalCreatorId(null);
            setSubscriptionsModalPlans([]);
            // Refresh the user lists
            window.location.reload();
          }}
        />
      )}
      </div>
    </>
  );
}