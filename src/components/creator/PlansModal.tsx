import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FiCheck } from 'react-icons/fi';
import { CATEGORY_LABELS } from '@/lib/constants';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import React from 'react';
import axios from 'axios';
import { getAuth } from 'firebase/auth';

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
  features?: string[];
  bundles?: { duration: number; price: number; discountPercent: number }[];
  discountSchedule?: { discountPercent: number }[];
  durationUnit?: string;
  isBundle?: boolean;
}

interface CreatorInfo {
  displayName: string;
  username: string;
  photoURL: string;
  coverPhotoUrl: string;
  isOnline: boolean;
  isVerified?: boolean;
}

interface PlansModalProps {
  open: boolean;
  onClose: () => void;
  plans: Plan[];
  onSelectPlan: (plan: Plan | null) => void;
  creatorId: string;
  onSubscriptionCancelled?: () => void;
}

const BENEFITS = [
  "Full access to this user's content",
  'Direct message with this user',
  'Cancel your subscription at any time',
];

// OnlyFans-style pricing limits
const MIN_SUBSCRIPTION_PRICE = 4.99;
const MAX_SUBSCRIPTION_PRICE = 50.00;

const SUBSCRIPTIONS_API_URL = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || '';

export default function PlansModal({ open, onClose, plans, onSelectPlan, creatorId, onSubscriptionCancelled }: PlansModalProps) {
  const [creator, setCreator] = useState<CreatorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showDiscounts, setShowDiscounts] = useState(true);
  const [showRenewal, setShowRenewal] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [subscriptionStartDate, setSubscriptionStartDate] = useState<Date | null>(null);
  const [subscriptionDuration, setSubscriptionDuration] = useState<number | null>(null);
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle'|'valid'|'invalid'|'expired'|'not-applicable'|'checking'>('idle');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountedPrice, setDiscountedPrice] = useState<number|null>(null);
  const [selectedBundleIdx, setSelectedBundleIdx] = useState<number | null>(null);
  const [isRecurringSubscription, setIsRecurringSubscription] = useState<boolean>(true);
  const [willRenew, setWillRenew] = useState<boolean>(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || '');
  const [showAllPlans, setShowAllPlans] = useState(false);

  useEffect(() => {
    const fetchCreatorInfo = async () => {
      try {
        const creatorDoc = await getDoc(doc(db, 'users', creatorId));
        if (creatorDoc.exists()) {
          const data = creatorDoc.data();
          setCreator({
            displayName: data.displayName || data.username,
            username: data.username,
            photoURL: data.photoURL,
            coverPhotoUrl: data.coverPhotoUrl,
            isOnline: data.isOnline,
            isVerified: data.isVerified || false,
          });
        }
      } catch (error) {
        console.error('Error fetching creator info:', error);
      } finally {
        setLoading(false);
      }
    };

    const checkSubscriptionStatus = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user || !creatorId) {
          setCheckingSubscription(false);
          return;
        }
        
        // Check subscription directly from Firestore (NO PAYMENT/API)
        const subscriptionQuery = query(
          collection(db, 'subscriptions'),
          where('subscriberId', '==', user.uid),
          where('creatorId', '==', creatorId),
          where('status', 'in', ['active', 'cancelled'])
        );
        const subscriptionsSnapshot = await getDocs(subscriptionQuery);
        
        if (subscriptionsSnapshot.empty) {
          setIsSubscribed(false);
          setSubscriptionStatus(null);
          setSubscriptionStartDate(null);
          setSubscriptionDuration(null);
          setExpirationDate(null);
          setCheckingSubscription(false);
          return;
        }
        
        // Get the most recent subscription
        const subscriptions = subscriptionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        const latestSubscription = subscriptions.sort((a, b) => {
          const aDate = a.startDate?.toDate?.() || new Date(a.startDate || 0);
          const bDate = b.startDate?.toDate?.() || new Date(b.startDate || 0);
          return bDate.getTime() - aDate.getTime();
        })[0];
        
        setSubscriptionStatus(latestSubscription.status || null);
        setIsRecurringSubscription(latestSubscription.isRecurring !== false);
        setWillRenew(latestSubscription.willRenew !== false);
        
        if (latestSubscription.startDate && latestSubscription.planId) {
          const startDate = latestSubscription.startDate?.toDate?.() || new Date(latestSubscription.startDate);
          setSubscriptionStartDate(startDate);
          
          // Calculate expiration from endDate if available, otherwise from plan duration
          if (latestSubscription.endDate) {
            const expires = latestSubscription.endDate?.toDate?.() || new Date(latestSubscription.endDate);
            setExpirationDate(expires);
            const duration = Math.ceil((expires.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            setSubscriptionDuration(duration);
          } else {
            // Fallback to plan duration
            const plan = plans.find(p => p.id === latestSubscription.planId);
            const duration = plan?.duration || 30;
            setSubscriptionDuration(duration);
            const expires = new Date(startDate);
            expires.setDate(expires.getDate() + duration);
            setExpirationDate(expires);
          }
          
          // Check if subscription is actually active (not expired)
          const now = new Date();
          const isActive = latestSubscription.status === 'active';
          const isCancelledButValid = latestSubscription.status === 'cancelled' && 
            latestSubscription.endDate &&
            (latestSubscription.endDate.toDate?.() || new Date(latestSubscription.endDate)).getTime() > now.getTime();
          setIsSubscribed(isActive || isCancelledButValid);
          
          // Mark current subscription plan as selected when modal opens
          if ((isActive || isCancelledButValid) && latestSubscription.planId && plans.length > 0) {
            const currentPlanId = latestSubscription.planId;
            // Check if this plan exists in the plans list and set it as selected
            const planExists = plans.find(p => p.id === currentPlanId);
            if (planExists) {
              // Always mark current plan when checking subscription status
              setSelectedPlanId(currentPlanId);
            } else if (plans.length > 0) {
              // If current plan not in list, default to first plan
              setSelectedPlanId(plans[0].id);
            }
          }
        } else {
          setIsSubscribed(false);
          setSubscriptionStartDate(null);
          setSubscriptionDuration(null);
          setExpirationDate(null);
        }
      } catch (error: any) {
        console.error('Error checking subscription status:', error);
        setIsSubscribed(false);
        setSubscriptionStatus(null);
        setSubscriptionStartDate(null);
        setSubscriptionDuration(null);
        setExpirationDate(null);
      } finally {
        setCheckingSubscription(false);
      }
    };

    if (open && creatorId) {
      fetchCreatorInfo();
      checkSubscriptionStatus();
    }
  }, [open, creatorId, plans]);

  useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans]);

  // Reset selectedPlanId when modal opens - default to first plan if not subscribed
  useEffect(() => {
    if (open && plans.length > 0 && !selectedPlanId && !isSubscribed) {
      // Only set default if user is NOT subscribed (if subscribed, checkSubscriptionStatus will set current plan)
      setSelectedPlanId(plans[0].id);
    }
  }, [open, plans, isSubscribed]);

  // Find the selected plan
  const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[0];
  const unit = selectedPlan?.durationUnit || 'days';

  // Dynamically generate bundles from discountSchedule
  const discountSchedule = selectedPlan?.discountSchedule || [];
  const baseDuration = selectedPlan?.duration || 1;
  const basePrice = selectedPlan?.price || 0;
  // Always include the base plan as the first option
  const generatedBundles = [
    {
      duration: baseDuration,
      price: basePrice,
      discountPercent: 0,
      label: `1 ${unit.slice(0, -1)}`,
    },
    ...discountSchedule.map((ds, idx) => {
      const period = idx + 2; // 2nd period, 3rd period, etc.
      const totalDuration = baseDuration * period;
      const discount = ds.discountPercent || 0;
      const totalPrice = +(basePrice * period * (1 - discount / 100)).toFixed(2);
      let label = '';
      if (unit === 'days') label = `${period} periods (${totalDuration} days)`;
      else if (unit === 'months') label = `${period} months`;
      else if (unit === 'years') label = `${period} years`;
      else label = `${period} periods (${totalDuration} ${unit})`;
      return {
        duration: totalDuration,
        price: totalPrice,
        discountPercent: discount,
        label,
      };
    })
  ];
  const selectedBundle = generatedBundles[selectedBundleIdx ?? 0];

  const validatePromoCode = async (code: string) => {
    setPromoStatus('checking');
    setDiscountPercent(0);
    setDiscountedPrice(null);
    try {
      const q = query(
        collection(db, 'promoCodes'),
        where('code', '==', code),
        where('isActive', '==', true),
        where('applicablePlanIds', 'array-contains', selectedPlan.id)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setPromoStatus('invalid');
        return;
      }
      const promo = snap.docs[0].data();
      const now = new Date();
      if (promo.expiresAt && promo.expiresAt.toDate() < now) {
        setPromoStatus('expired');
        return;
      }
      setPromoStatus('valid');
      setDiscountPercent(promo.discountPercent);
      setDiscountedPrice(selectedPlan ? +(selectedPlan.price * (1 - promo.discountPercent / 100)).toFixed(2) : null);
    } catch (e) {
      setPromoStatus('invalid');
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setError('You must be logged in to subscribe.');
        setLoading(false);
        return;
      }
      
      if (!selectedPlan) {
        setError('Please select a plan.');
        setLoading(false);
        return;
      }
      
      // Check if already subscribed to the SAME plan (prevent duplicate subscription to same plan)
      // But allow changing to a different plan
      const existingSubQuery = query(
        collection(db, 'subscriptions'),
        where('subscriberId', '==', user.uid),
        where('creatorId', '==', creatorId),
        where('status', '==', 'active')
      );
      const existingSubs = await getDocs(existingSubQuery);
      if (!existingSubs.empty) {
        // Check if user is subscribed to the same plan
        const existingSub = existingSubs.docs[0].data();
        if (existingSub.planId === selectedPlan.id) {
          setError('You are already subscribed to this plan.');
          setLoading(false);
          return;
        }
        // If subscribed to a different plan, we'll update/change the subscription
        // Cancel the old subscription first
        const oldSubRef = doc(db, 'subscriptions', existingSubs.docs[0].id);
        await setDoc(oldSubRef, {
          ...existingSub,
          status: 'cancelled',
          willRenew: false,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      
      // Calculate dates
      const now = Timestamp.now();
      let endDate: Timestamp | null = null;
      let nextBillingDate: Timestamp | null = null;
      
      // Get plan details to determine duration
      const planDoc = await getDoc(doc(db, 'plans', selectedPlan.id));
      if (!planDoc.exists()) {
        setError('Plan not found.');
        setLoading(false);
        return;
      }
      
      const planData = planDoc.data();
      const billingInterval = planData.billingInterval || 'month';
      const intervalCount = planData.intervalCount || 1;
      
      // Calculate end date based on billing interval
      const startDate = new Date();
      if (billingInterval === 'month') {
        const endDateCalc = new Date(startDate);
        endDateCalc.setMonth(endDateCalc.getMonth() + intervalCount);
        endDate = Timestamp.fromDate(endDateCalc);
        nextBillingDate = Timestamp.fromDate(new Date(endDateCalc));
      } else if (billingInterval === 'day') {
        const endDateCalc = new Date(startDate);
        endDateCalc.setDate(endDateCalc.getDate() + intervalCount);
        endDate = Timestamp.fromDate(endDateCalc);
        nextBillingDate = Timestamp.fromDate(new Date(endDateCalc));
      } else if (billingInterval === 'year') {
        const endDateCalc = new Date(startDate);
        endDateCalc.setFullYear(endDateCalc.getFullYear() + intervalCount);
        endDate = Timestamp.fromDate(endDateCalc);
        nextBillingDate = Timestamp.fromDate(new Date(endDateCalc));
      } else {
        // Default to 30 days if no interval specified
        const endDateCalc = new Date(startDate);
        endDateCalc.setDate(endDateCalc.getDate() + 30);
        endDate = Timestamp.fromDate(endDateCalc);
        nextBillingDate = Timestamp.fromDate(new Date(endDateCalc));
      }
      
      // Create subscription document directly in Firestore (NO PAYMENT)
      const subscriptionId = `${user.uid}_${creatorId}`;
      const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
      
      const subscriptionData = {
        id: subscriptionId,
        subscriberId: user.uid,
        creatorId: creatorId,
        planId: selectedPlan.id,
        status: 'active',
        startDate: now,
        endDate: endDate,
        nextBillingDate: nextBillingDate,
        isRecurring: planData.isRecurring !== false, // Default to true if not specified
        willRenew: true,
        createdAt: now,
        updatedAt: now,
        ...(promoStatus === 'valid' && promoCode ? { promoCode, promoDiscountPercent: discountPercent } : {})
      };
      
      await setDoc(subscriptionRef, subscriptionData);
      
      setSuccess(true);
      setIsSubscribed(true);
      onSelectPlan(selectedPlan);
      
      // Refresh subscription status will be handled by useEffect on next render
      
    } catch (err: any) {
      console.error('Subscription creation error:', err);
      setError(err.message || 'Failed to create subscription.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCanceling(true);
    setError(null);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setError('You must be logged in to cancel.');
        setCanceling(false);
        return;
      }
      
      // Find the active subscription directly from Firestore (NO PAYMENT/API)
      const subscriptionQuery = query(
        collection(db, 'subscriptions'),
        where('subscriberId', '==', user.uid),
        where('creatorId', '==', creatorId),
        where('status', '==', 'active')
      );
      const subscriptionsSnapshot = await getDocs(subscriptionQuery);
      
      if (subscriptionsSnapshot.empty) {
        setError('No active subscription found.');
        setCanceling(false);
        return;
      }
      
      // Get the subscription document
      const subscriptionDoc = subscriptionsSnapshot.docs[0];
      const subscriptionRef = doc(db, 'subscriptions', subscriptionDoc.id);
      const subscriptionData = subscriptionDoc.data();
      
      // Cancel the subscription - set status to 'cancelled' and keep endDate
      await setDoc(subscriptionRef, {
        ...subscriptionData,
        status: 'cancelled',
        willRenew: false,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Update local state
      setSubscriptionStatus('cancelled');
      setWillRenew(false);
      
      // Calculate expiration date
      let expires = null;
      if (subscriptionData.endDate) {
        expires = subscriptionData.endDate?.toDate?.() || new Date(subscriptionData.endDate);
        setExpirationDate(expires);
      }

      // Only set isSubscribed to false if the subscription is actually expired
      const now = Date.now();
      const isCancelledButValid = !!expires && expires.getTime() > now;
      setIsSubscribed(isCancelledButValid);
      
      setSuccess(false);
      if (onSelectPlan) onSelectPlan(null); // Notify parent
      if (typeof onSubscriptionCancelled === 'function') onSubscriptionCancelled();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel subscription.');
    } finally {
      setCanceling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[340px] w-[calc(100%-32px)] p-0 overflow-visible border-0 shadow-none">
        <DialogTitle className="sr-only">Subscription</DialogTitle>
        <DialogDescription className="sr-only">Manage your subscription to this creator.</DialogDescription>
        <div 
          className="relative bg-white overflow-hidden"
          style={{
            borderRadius: '17px 17px 27px 27px',
            boxShadow: '0px 187px 75px rgba(0, 0, 0, 0.01), 0px 105px 63px rgba(0, 0, 0, 0.05), 0px 47px 47px rgba(0, 0, 0, 0.09), 0px 12px 26px rgba(0, 0, 0, 0.1), 0px 0px 0px rgba(0, 0, 0, 0.1)'
          }}
        >
          {/* Cover Photo with gradient overlay - Like CreatorCard */}
          <div 
            className="relative w-full h-32 overflow-hidden"
            style={{ 
              borderRadius: '17px 17px 27px 27px'
            }}
          >
              <img
              src={creator?.coverPhotoUrl || '/default-avatar.png'}
              alt={`${creator?.displayName || creator?.username}'s cover`}
              className="w-full h-full object-cover"
              />
            {/* Dark gradient overlay for text visibility */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, transparent 0%, transparent 20%, rgba(0, 0, 0, 0.3) 60%, rgba(0, 0, 0, 0.8) 100%)',
                borderRadius: '17px 17px 27px 27px'
              }}
            />
            
            {/* Profile Photo and Names positioned over cover photo - Like CreatorCard */}
            <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
              <div className="flex items-start">
            <div className="relative">
              <img
                src={creator?.photoURL || '/default-avatar.png'}
                    alt={creator?.displayName || creator?.username || 'Creator'}
                    className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md flex-shrink-0"
                    style={{ marginTop: '-20px' }}
              />
                  {/* Online status indicator */}
              {creator?.isOnline && (
                    <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0 ml-2">
                  <div className="flex items-center gap-1.5">
                    <h3 
                      className="text-base font-bold truncate"
                      style={{ 
                        color: '#ffffff', 
                        fontWeight: '700',
                        fontSize: '16px',
                        lineHeight: '1.2',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                      }}
                    >
                      {creator?.displayName || 'Creator'}
                    </h3>
                    {creator?.isVerified && (
                      <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))' }}>
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
              )}
            </div>
                  <p 
                    className="text-xs truncate"
                    style={{ 
                      color: '#d1d5db',
                      fontSize: '12px',
                      lineHeight: '1.2',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                    }}
                  >
                    @{creator?.username || 'username'}
                  </p>
                </div>
          </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="p-4">

            {/* Benefits Section - Above buttons */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                SUBSCRIBE AND GET THESE BENEFITS:
              </h4>
              <ul className="space-y-2">
                {(() => {
                  const currentPlan = plans.find(p => p.id === selectedPlanId) || plans[0];
                  const isFreePlan = currentPlan?.price === 0;
                  
                  return (
                    <>
                      {isFreePlan ? (
                        <>
                          <li className="flex items-start gap-2">
                            <FiCheck className="text-blue-500 mt-0.5 flex-shrink-0" size={16} />
                            <span className="text-sm text-gray-700">Access to subscriber-only content</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <FiCheck className="text-blue-500 mt-0.5 flex-shrink-0" size={16} />
                            <span className="text-sm text-gray-700">Note: Premium content may require a paid subscription</span>
                          </li>
                        </>
                      ) : (
                        <li className="flex items-start gap-2">
                          <FiCheck className="text-blue-500 mt-0.5 flex-shrink-0" size={16} />
                          <span className="text-sm text-gray-700">Access to all content including premium posts</span>
                        </li>
                      )}
                      <li className="flex items-start gap-2">
                        <FiCheck className="text-blue-500 mt-0.5 flex-shrink-0" size={16} />
                        <span className="text-sm text-gray-700">Direct message with this user</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <FiCheck className="text-blue-500 mt-0.5 flex-shrink-0" size={16} />
                        <span className="text-sm text-gray-700">Cancel your subscription at any time</span>
                      </li>
                    </>
                  );
                })()}
            </ul>
          </div>

            {/* Subscription Buttons - Selectable - Always show all plans */}
            {plans.length > 0 && (
              <div>
                <div className="space-y-2">
                   {(showAllPlans ? plans : plans.slice(0, 2)).map((plan) => {
                     const isSelected = selectedPlanId === plan.id;
                     return (
            <button
                         key={plan.id}
                         onClick={() => {
                           setSelectedPlanId(plan.id);
                         }}
                         disabled={loading || checkingSubscription}
                         className={`w-full py-1 sm:py-1.5 px-4 sm:px-4.5 rounded-full font-bold text-xs flex items-center justify-between transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                           isSelected ? 'text-white' : 'text-gray-700 border-2 border-gray-300 hover:border-blue-400'
                         }`}
                         style={{
                           background: isSelected ? '#00a8ff' : '#ffffff',
                           boxShadow: isSelected ? `
                             0 3px 6px rgba(0, 0, 0, 0.3),
                             0 1px 3px rgba(0, 0, 0, 0.2),
                             inset 0 2px 4px rgba(255, 255, 255, 0.3),
                             inset 0 -1px 2px rgba(0, 0, 0, 0.2)
                           ` : `
                             0 1px 3px rgba(0, 0, 0, 0.1)
                           `,
                           border: isSelected ? '1px solid rgba(255, 255, 255, 0.2)' : '2px solid #d1d5db',
                           position: 'relative',
                           overflow: 'hidden',
                           transform: 'perspective(500px) rotateX(0deg)'
                         }}
                         onMouseEnter={(e) => {
                           if (!loading && !checkingSubscription) {
                             if (isSelected) {
                               e.currentTarget.style.boxShadow = `
                                 0 5px 12px rgba(0, 168, 255, 0.5),
                                 0 2px 6px rgba(0, 0, 0, 0.3),
                                 inset 0 3px 6px rgba(255, 255, 255, 0.4),
                                 inset 0 -2px 4px rgba(0, 0, 0, 0.25)
                               `;
                               e.currentTarget.style.transform = 'translateY(-1px) scale(1.02)';
                             } else {
                               e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 168, 255, 0.3)';
                               e.currentTarget.style.transform = 'translateY(-1px) scale(1.01)';
                             }
                           }
                         }}
                         onMouseLeave={(e) => {
                           if (isSelected) {
                             e.currentTarget.style.boxShadow = `
                               0 3px 6px rgba(0, 0, 0, 0.3),
                               0 1px 3px rgba(0, 0, 0, 0.2),
                               inset 0 2px 4px rgba(255, 255, 255, 0.3),
                               inset 0 -1px 2px rgba(0, 0, 0, 0.2)
                             `;
                             e.currentTarget.style.transform = 'translateY(0) scale(1)';
                           } else {
                             e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                             e.currentTarget.style.transform = 'translateY(0) scale(1)';
                           }
                         }}
                         onMouseDown={(e) => {
                           if (!loading && !checkingSubscription && isSelected) {
                             e.currentTarget.style.transform = 'translateY(1px) scale(0.98)';
                             e.currentTarget.style.boxShadow = `
                               0 1px 3px rgba(0, 0, 0, 0.4),
                               inset 0 1px 2px rgba(0, 0, 0, 0.3)
                             `;
                           }
                         }}
                         onMouseUp={(e) => {
                           if (!loading && !checkingSubscription && isSelected) {
                             e.currentTarget.style.transform = 'translateY(-1px) scale(1.02)';
                             e.currentTarget.style.boxShadow = `
                               0 5px 12px rgba(0, 168, 255, 0.5),
                               0 2px 6px rgba(0, 0, 0, 0.3),
                               inset 0 3px 6px rgba(255, 255, 255, 0.4),
                               inset 0 -2px 4px rgba(0, 0, 0, 0.25)
                             `;
                           }
                         }}
                       >
                         <span className="relative z-10 drop-shadow-sm">SUBSCRIBE</span>
                         <span className={`relative z-10 text-xs drop-shadow-sm ${isSelected ? '' : 'text-gray-600'}`}>
                           {plan.price === 0 ? 'Free' : `$${plan.price.toFixed(2)}`} / {plan.isRecurring ? 'Monthly' : `${plan.intervalCount || plan.duration || 30} days`}
              </span>
            </button>
                     );
                   })}
                </div>
                {/* Show/Hide more plans if more than 2 */}
                {plans.length > 2 && (
              <button
                    onClick={() => setShowAllPlans(!showAllPlans)}
                    className="w-full mt-2 text-xs text-blue-500 hover:text-blue-600 flex items-center justify-center gap-1 py-1"
                  >
                    {showAllPlans ? 'Show Less' : `Show ${plans.length - 2} More Plan${plans.length - 2 > 1 ? 's' : ''}`}
                    <svg
                      className={`w-3 h-3 transition-transform ${showAllPlans ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
              </button>
            )}
              </div>
            )}

            {/* Policy Text - Under subscription buttons */}
            {!isSubscribed && plans.length > 0 && (
              <div className="mt-4 space-y-1.5 text-xs text-gray-600">
                {plans.some(p => p.price > 0) && (
                  <>
                    <p>• Your subscription will renew until you choose to cancel your subscription.</p>
                    <p>• If you cancel your subscription you will still have access until it expires.</p>
                    <p>• Subject to our <a href="/terms" className="text-blue-500 underline" target="_blank" rel="noopener noreferrer">Terms of Service</a>.</p>
                  </>
                )}
              </div>
            )}

            {/* Cancel confirmation dialog */}
            <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
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
                      onClick={() => setShowCancelConfirm(false)}
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
                      onClick={() => {
                        setShowCancelConfirm(false);
                        handleCancelSubscription();
                      }}
                    disabled={canceling}
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
                    {canceling ? 'Cancelling...' : 'Cancel Subscription'}
                  </Button>
                </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Promo Code Input - OnlyFans style (hidden by default, show if needed) */}
            {!isSubscribed && promoCode && (
              <div className="mb-3 flex flex-col items-center">
                <div className="flex gap-2 items-center w-full">
                  <input
                    type="text"
                    placeholder="Promo code"
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value)}
                    className="flex-1 border rounded px-2 py-1.5 text-xs"
                    disabled={promoStatus === 'checking'}
                  />
                  <button
                    className="text-xs px-3 py-1.5 rounded bg-blue-500 text-white disabled:opacity-50 hover:bg-blue-600"
                    onClick={() => validatePromoCode(promoCode)}
                    disabled={!promoCode || promoStatus === 'checking'}
                  >
                    {promoStatus === 'checking' ? 'Checking...' : 'Apply'}
                  </button>
                </div>
                {promoStatus === 'valid' && <span className="text-green-600 text-xs mt-1">{discountPercent}% off!</span>}
                {promoStatus === 'invalid' && <span className="text-red-600 text-xs mt-1">Invalid code</span>}
                {promoStatus === 'expired' && <span className="text-yellow-600 text-xs mt-1">Expired</span>}
              </div>
            )}
            {/* Error/Success Messages */}
            {error && <div className="text-xs text-red-600 text-center mb-3 bg-red-50 p-2 rounded">{error}</div>}
            {success && <div className="text-xs text-green-600 text-center mb-3 bg-green-50 p-2 rounded">Subscription successful!</div>}

            {/* --- STATUS MESSAGES (as before) --- */}
            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
            {/* @ts-ignore: runtime check for subscriptionStatus is valid */}
            {subscriptionStatus === 'cancelled' && expirationDate instanceof Date && expirationDate.getTime() > Date.now() && (
              <div className="text-xs text-blue-700 text-center mt-2 font-semibold">
                Your subscription was cancelled. You still have access until {expirationDate.toLocaleDateString()}.
              </div>
            )}
            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
            {/* @ts-ignore: runtime check for subscriptionStatus is valid */}
            {subscriptionStatus === 'expired' && expirationDate instanceof Date && expirationDate.getTime() <= Date.now() && (
              <div className="text-xs text-gray-700 text-center mb-1">
                Your subscription has expired on {expirationDate.toLocaleDateString()}.
              </div>
            )}
            {subscriptionStatus === 'active' && isRecurringSubscription && willRenew && (
              <>
                <div className="text-xs text-gray-600 text-center mb-1">
                  {selectedPlan ? `This subscription renews at $${selectedPlan.price.toFixed(2)}.` : ''}
                </div>
                <div className="text-xs text-blue-600 text-center cursor-pointer select-none" onClick={() => setShowRenewal(v => !v)}>
                  {showRenewal ? 'Hide renewal info' : 'Show renewal info'}
                </div>
                {showRenewal && (
                  <div className="text-xs text-gray-600 mt-2 border-t pt-2">
                    <div>Your subscription will automatically renew at ${selectedPlan.price.toFixed(2)}.</div>
                    <div>You can cancel anytime and still have access until the end of your billing period.</div>
                    <div>Subject to our <a href="/terms" className="underline text-blue-600" target="_blank" rel="noopener noreferrer">Terms of Service</a>.</div>
                  </div>
                )}
              </>
            )}
            {subscriptionStatus === 'active' && !isRecurringSubscription && (
              <div className="text-xs text-blue-700 text-center mt-2 font-semibold">
                This bundle does not auto-renew. You'll need to re-subscribe when it expires.<br />
                {expirationDate instanceof Date && expirationDate.getTime() > Date.now() && (
                  <>Your subscription is active until {expirationDate.toLocaleDateString()}.</>
                )}
              </div>
            )}
            {/* Confirm, Cancel, and Close Buttons */}
            {plans.length > 0 && (
              <div className="flex justify-between items-center pt-2 border-t border-gray-200 gap-2">
                {/* Cancel Subscription Button - Only show if subscribed with active subscription */}
                {isSubscribed && subscriptionStatus === 'active' ? (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={canceling}
                    className="text-red-500 text-sm font-medium hover:text-red-600 transition-colors px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {canceling ? 'Cancelling...' : 'Cancel Subscription'}
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors px-3 py-1.5"
                  >
                    CLOSE
                  </button>
                )}
                {/* Confirm Button - Always show if plan is selected (allows plan changes) */}
                {selectedPlanId && !canceling && (
                  <button
                    onClick={handleSubscribe}
                    disabled={loading || checkingSubscription}
                    className="text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed px-6 py-1.5 rounded-full"
                    style={{
                      background: '#00a8ff',
                      boxShadow: `
                        0 3px 6px rgba(0, 0, 0, 0.3),
                        0 1px 3px rgba(0, 0, 0, 0.2),
                        inset 0 2px 4px rgba(255, 255, 255, 0.3),
                        inset 0 -1px 2px rgba(0, 0, 0, 0.2)
                      `,
                    }}
                  >
                    {loading ? 'SUBSCRIBING...' : 'CONFIRM'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}