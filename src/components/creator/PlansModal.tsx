import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FiCheck } from 'react-icons/fi';
import { CATEGORY_LABELS } from '@/lib/constants';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import React from 'react';
import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { Dialog as UIDialog } from '@/components/ui/dialog';

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
        const idToken = await user.getIdToken();
        const response = await axios.get(
          `${SUBSCRIPTIONS_API_URL}/to/${creatorId}/latest`,
          {
            headers: {
              Authorization: `Bearer ${idToken}`
            }
          }
        );
        setSubscriptionStatus(response.data.status || null);
        setIsRecurringSubscription(response.data.isRecurring !== false); // default to true if missing
        setWillRenew(response.data.willRenew !== false); // default to true if missing
        let expires = null;
        if (response.status === 200 && response.data && response.data.startDate && response.data.planId) {
          // Find the plan duration
          const plan = plans.find(p => p.id === response.data.planId);
          const duration = plan ? plan.duration : 30; // fallback to 30 days
          setSubscriptionDuration(duration);
          // Parse startDate
          const startDate = response.data.startDate._seconds
            ? new Date(response.data.startDate._seconds * 1000)
            : new Date(response.data.startDate);
          setSubscriptionStartDate(startDate);
          // Calculate expiration date
          expires = response.data.endDate?._seconds
            ? new Date(response.data.endDate._seconds * 1000)
            : new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
          setExpirationDate(expires);
        } else {
          setSubscriptionStartDate(null);
          setSubscriptionDuration(null);
          setExpirationDate(null);
        }
        // --- UPDATED LOGIC ---
        const now = Date.now();
        const isActive = response.data.status === 'active';
        const isCancelledButValid = response.data.status === 'cancelled' && !!expires && (expires as Date).getTime() > now;
        setIsSubscribed(isActive || isCancelledButValid);
      } catch (error) {
        // If 404, user is not subscribed - this is a valid state
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setIsSubscribed(false);
          setSubscriptionStatus(null);
          setSubscriptionStartDate(null);
          setSubscriptionDuration(null);
          setExpirationDate(null);
          setCheckingSubscription(false);
          return;
        }
        // For other errors, log and reset state
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
  }, [open, creatorId]);

  useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans]);

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
      if (!SUBSCRIPTIONS_API_URL) {
        setError('Subscription API URL is not configured.');
        setLoading(false);
        return;
      }
      const idToken = await user.getIdToken();
      const res = await axios.post(
        SUBSCRIPTIONS_API_URL,
        { creatorId, planId: selectedPlan.id, promoCode: promoStatus === 'valid' ? promoCode : undefined },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      setSuccess(true);
      setIsSubscribed(true);
      onSelectPlan(selectedPlan);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to subscribe.');
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
      if (!SUBSCRIPTIONS_API_URL) {
        setError('Subscription API URL is not configured.');
        setCanceling(false);
        return;
      }
      const idToken = await user.getIdToken();
      // 1. Fetch the latest subscription to get the subscriptionId
      const subRes = await axios.get(
        `${SUBSCRIPTIONS_API_URL}/to/${creatorId}/latest`,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      const subscriptionId = subRes.data.id;
      // 2. Cancel the subscription using the correct endpoint
      const cancelRes = await axios.put(
        `${SUBSCRIPTIONS_API_URL}/${subscriptionId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      
      // Update subscription status
      setSubscriptionStatus(cancelRes.data.status || null);
      
      // Calculate expiration date
      let expires = null;
      if (cancelRes.data && cancelRes.data.endDate) {
        expires = cancelRes.data.endDate._seconds
          ? new Date(cancelRes.data.endDate._seconds * 1000)
          : new Date(cancelRes.data.endDate);
        setExpirationDate(expires);
      }

      // Only set isSubscribed to false if the subscription is actually expired
      const now = Date.now();
      const isActive = cancelRes.data.status === 'active';
      const isCancelledButValid = cancelRes.data.status === 'cancelled' && 
        !!expires && 
        expires.getTime() > now;
      setIsSubscribed(isActive || isCancelledButValid);
      
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
      <DialogContent className="sm:max-w-[340px] p-0">
        <DialogTitle className="sr-only">Subscription</DialogTitle>
        <DialogDescription className="sr-only">Manage your subscription to this creator.</DialogDescription>
        <div className="relative bg-white rounded-2xl overflow-hidden shadow-xl">
          {/* Cover Photo */}
          <div className="relative h-20 bg-gray-200">
            {creator?.coverPhotoUrl && (
              <img
                src={creator.coverPhotoUrl}
                alt="Cover"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </div>
          {/* Profile Photo, Name, Username, Status */}
          <div className="relative flex flex-col items-center -mt-8 mb-2 z-10">
            <div className="relative">
              <img
                src={creator?.photoURL || '/default-avatar.png'}
                className="w-14 h-14 rounded-full border-2 border-white shadow-lg object-cover bg-white"
                alt={creator?.displayName || 'Creator'}
              />
              {/* Status indicator */}
              {creator?.isOnline && (
                <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full" />
              )}
            </div>
            <div className="mt-1 text-base font-bold text-gray-900 text-center">{creator?.displayName || 'Creator'}</div>
            <div className="text-gray-500 text-xs text-center">@{creator?.username || 'username'}</div>
          </div>

          {/* Plan Selection */}
          <div className="px-4 mt-2 mb-4">
            <div className="font-semibold text-gray-700 mb-1 text-center text-sm">Choose a Plan:</div>
            <div className="flex flex-col gap-2">
              {plans.map(plan => (
                <label key={plan.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${selectedPlanId === plan.id ? 'border-fuchsia-500 bg-fuchsia-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="plan"
                    value={plan.id}
                    checked={selectedPlanId === plan.id}
                    onChange={() => setSelectedPlanId(plan.id)}
                    className="accent-fuchsia-500"
                  />
                  <span className="font-bold text-gray-900">{plan.name}</span>
                  <span className="text-xs text-gray-500">{plan.price === 0 ? 'Free' : `$${plan.price.toFixed(2)}`} / {plan.duration} {plan.durationUnit || 'days'}</span>
                  {plan.description && <span className="text-xs text-gray-400 ml-2">{plan.description}</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Benefits Section */}
          <div className="px-4 mt-2">
            <div className="font-semibold text-gray-700 mb-1 text-center text-sm">Plan Includes:</div>
            <ul className="space-y-1 text-xs mb-3 text-center flex flex-col items-center">
              <li className="flex items-center text-gray-700 justify-center"><FiCheck className="text-blue-500 mr-2" /> Full access to all of this creator's content</li>
              <li className="flex items-center text-gray-700 justify-center"><FiCheck className="text-blue-500 mr-2" /> Access to all new uploads during your subscription</li>
              <li className="flex items-center text-gray-700 justify-center"><FiCheck className="text-blue-500 mr-2" /> Cancel anytime, no commitment</li>
            </ul>
          </div>

          {/* Subscribe Button */}
          <div className="px-4 mb-2">
            <button
              className="mx-auto flex items-center justify-between bg-gradient-to-br from-fuchsia-700 to-indigo-700 hover:from-indigo-700 hover:to-fuchsia-700 text-white font-bold py-1 px-2 rounded-full text-xs transition-colors mb-2 disabled:opacity-50 disabled:cursor-not-allowed max-w-xs w-full"
              onClick={handleSubscribe}
              disabled={!selectedPlan || loading || checkingSubscription || isSubscribed}
            >
              <span>
                {loading ? 'Subscribing...' : 
                 checkingSubscription ? 'Checking...' :
                 isSubscribed ? 'SUBSCRIBED' : 'SUBSCRIBE'}
              </span>
              <span>{selectedPlan ? (selectedPlan.price === 0 ? 'Free' : `$${selectedPlan.price.toFixed(2)}`) + ` per ${selectedPlan.duration} ${unit}` : ''}</span>
            </button>
            {/* Cancel Subscription Button */}
            {isSubscribed && subscriptionStatus === 'active' && willRenew && (
              <button
                className="mx-auto flex items-center justify-center bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-full text-xs transition-colors mb-2 disabled:opacity-50 disabled:cursor-not-allowed max-w-xs w-full"
                onClick={() => setShowCancelConfirm(true)}
                disabled={canceling}
              >
                {canceling ? 'Cancelling...' : 'Cancel Subscription'}
              </button>
            )}
            {/* Cancel confirmation dialog */}
            {showCancelConfirm && (
              <UIDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
                <DialogContent>
                  <DialogTitle>Cancel Subscription</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to cancel your subscription? You will keep access until the end of your paid period.
                  </DialogDescription>
                  <div className="flex gap-2 mt-4">
                    <button
                      className="flex-1 bg-gray-200 text-gray-800 rounded px-3 py-1"
                      onClick={() => setShowCancelConfirm(false)}
                    >
                      Keep Subscription
                    </button>
                    <button
                      className="flex-1 bg-red-500 text-white rounded px-3 py-1"
                      onClick={() => {
                        setShowCancelConfirm(false);
                        handleCancelSubscription();
                      }}
                    >
                      Confirm Cancel
                    </button>
                  </div>
                </DialogContent>
              </UIDialog>
            )}
            {/* Promo Code Input - moved to center */}
            {!isSubscribed && (
              <div className="mb-2 flex flex-col items-center justify-center">
                <div className="flex gap-2 items-center justify-center">
                  <input
                    type="text"
                    placeholder="Promo code"
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value)}
                    className="border rounded px-2 py-1 text-xs w-24"
                    disabled={promoStatus === 'checking'}
                  />
                  <button
                    className="text-xs px-2 py-1 rounded bg-blue-500 text-white disabled:opacity-50"
                    onClick={() => validatePromoCode(promoCode)}
                    disabled={!promoCode || promoStatus === 'checking'}
                  >
                    {promoStatus === 'checking' ? 'Checking...' : 'Apply'}
                  </button>
                  {promoStatus === 'valid' && <span className="text-green-600 text-xs ml-2">{discountPercent}% off!</span>}
                  {promoStatus === 'invalid' && <span className="text-red-600 text-xs ml-2">Invalid code</span>}
                  {promoStatus === 'expired' && <span className="text-yellow-600 text-xs ml-2">Expired</span>}
                </div>
                {discountedPrice !== null && promoStatus === 'valid' && (
                  <div className="text-xs text-green-700 mt-1">Discounted price: ${discountedPrice.toFixed(2)}</div>
                )}
              </div>
            )}
            {error && <div className="text-xs text-red-600 text-center mb-1">{error}</div>}
            {success && <div className="text-xs text-green-600 text-center mb-1">Subscription successful!</div>}

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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}