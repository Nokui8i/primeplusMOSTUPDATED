'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { getAuth } from 'firebase/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { Globe, Lock, Check, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Plan {
  id: string;
  name: string;
  price: number;
  duration?: number;
  billingInterval?: 'day' | 'week' | 'month' | 'year';
  intervalCount?: number;
  isActive: boolean;
  isRecurring?: boolean;
  allowedCategories: string[];
  description?: string;
  discountPercent?: number;
  totalPrice?: number;
  creatorId: string;
  features?: string[];
  bundles?: { duration: number; price: number; discountPercent: number; label: string }[];
  discountSchedule?: { period: number; discountPercent: number }[];
  durationUnit?: string;
  isBundle?: boolean;
}

interface SubscriptionContainerProps {
  creatorId: string;
  isSubscribed: boolean;
  checkingSubscription: boolean;
  onSubscribe: (planId: string, price: number, duration: number) => void;
}

const SUBSCRIPTIONS_API_URL = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || '';

export function SubscriptionContainer({
  creatorId,
  isSubscribed,
  checkingSubscription,
  onSubscribe
}: SubscriptionContainerProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [postCount, setPostCount] = useState(0);
  const [mediaCount, setMediaCount] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<any>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
  const [showBundles, setShowBundles] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!creatorId) {
        console.log('SubscriptionContainer: No creatorId provided');
        return;
      }
      
      console.log('SubscriptionContainer: Fetching data for creator:', creatorId);
      
      try {
        // Fetch plans
        const plansQuery = query(
          collection(db, 'plans'),
          where('creatorId', '==', creatorId),
          where('isActive', '==', true)
        );
        const plansSnapshot = await getDocs(plansQuery);
        const fetchedPlans = plansSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Plan)).sort((a, b) => a.price - b.price); // Sort by price after fetching
        console.log('SubscriptionContainer: Fetched plans:', fetchedPlans.length, fetchedPlans);
        console.log('SubscriptionContainer: Plan details:', fetchedPlans.map(p => ({ 
          id: p.id, 
          price: p.price, 
          billingInterval: p.billingInterval,
          intervalCount: p.intervalCount,
          duration: p.duration, 
          durationUnit: p.durationUnit,
          name: p.name
        })));
        console.log('Full plan data:', JSON.stringify(fetchedPlans, null, 2));
        setPlans(fetchedPlans);
        if (fetchedPlans.length > 0) {
          setSelectedPlan(fetchedPlans[0]);
        }

        // Fetch post counts
        const postsQuery = query(
          collection(db, 'posts'),
          where('authorId', '==', creatorId),
          where('isDeleted', '==', false)
        );
        const postsSnapshot = await getDocs(postsQuery);
        const posts = postsSnapshot.docs;
        setPostCount(posts.length);
        
        // Count media posts
        const mediaPosts = posts.filter(post => {
          const data = post.data();
          return data.type === 'image' || data.type === 'video' || data.type === 'image360' || data.type === 'video360';
        });
        setMediaCount(mediaPosts.length);

        // Check subscription status
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          try {
            const idToken = await user.getIdToken();
            const response = await axios.get(
              `${SUBSCRIPTIONS_API_URL}/to/${creatorId}/latest`,
              { headers: { Authorization: `Bearer ${idToken}` } }
            );
            setSubscriptionStatus(response.data);
          } catch (err: any) {
            if (err.response?.status !== 404) {
              console.error('Error checking subscription:', err);
            }
          }
        }
      } catch (error: any) {
        console.error('Error fetching data:', error);
        console.error('Error details:', {
          code: error?.code,
          message: error?.message,
          stack: error?.stack
        });
        toast.error('Failed to load subscription plans');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [creatorId]);

  const handleSubscribe = async (plan: Plan, bundle?: any) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        toast.error('Please log in to subscribe');
        return;
      }

      const idToken = await user.getIdToken();
      
      // Calculate price and duration
      let price = plan.price;
      let duration = plan.duration;
      
      if (bundle) {
        price = bundle.price;
        duration = bundle.duration;
      }

      // Call subscription API
      const response = await axios.post(
        `${SUBSCRIPTIONS_API_URL}/subscribe`,
        {
          subscriberId: user.uid,
          creatorId: creatorId,
          planId: plan.id,
          bundleDuration: duration,
        },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );

      if (response.data.success) {
        toast.success('Successfully subscribed!');
        onSubscribe(plan.id, price, duration);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast.error(response.data.error || 'Subscription failed');
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error(error.response?.data?.error || 'Failed to subscribe');
    }
  };

  if (loading || checkingSubscription) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isSubscribed && subscriptionStatus) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
        <div className="text-center space-y-4">
          <div className="text-2xl font-bold text-gray-800">Already Subscribed</div>
          <div className="text-sm text-gray-600">
            You have an active subscription
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm font-semibold text-blue-800 mb-2">Status: {subscriptionStatus.status}</div>
            {subscriptionStatus.endDate && (
              <div className="text-xs text-gray-600">
                Expires: {new Date(subscriptionStatus.endDate._seconds * 1000).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="bg-gray-100 rounded-lg shadow-lg p-6 max-w-md mx-auto text-center">
        <div className="text-xl font-bold text-gray-700 mb-2">No Subscription Plans Available</div>
        <div className="text-sm text-gray-600">
          This creator hasn't set up any subscription plans yet.
        </div>
      </div>
    );
  }

  if (!selectedPlan) {
    return null;
  }

  // Calculate bundles
  const getBundles = (plan: Plan) => {
    if (!plan.bundles && !plan.discountSchedule) return [];
    
    const bundles = [];
    
    if (plan.bundles && plan.bundles.length > 0) {
      return plan.bundles.map(bundle => ({
        duration: bundle.duration,
        price: bundle.price,
        discountPercent: bundle.discountPercent,
        monthsCount: Math.ceil(bundle.duration / (plan.duration || 1)),
        label: bundle.label || `${bundle.duration} ${plan.durationUnit || 'days'}`
      }));
    }
    
    if (plan.discountSchedule && plan.discountSchedule.length > 0) {
      plan.discountSchedule.forEach(discount => {
        const bundles = {
          duration: plan.duration * discount.period,
          price: Math.round((plan.price * discount.period) * (1 - discount.discountPercent / 100) * 100) / 100,
          discountPercent: discount.discountPercent,
          monthsCount: discount.period,
          label: `${discount.period} MONTHS`
        };
      });
    }
    
    return bundles;
  };

  const bundles = getBundles(selectedPlan || plans[0]);

  return (
    <div className="w-full px-6 py-0">
      <Card className="p-3">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsCollapsed(!isCollapsed)}>
          <CardTitle className="text-sm font-bold text-gray-600 uppercase tracking-wide">Subscriptions</CardTitle>
          <ChevronUp className={`h-4 w-4 text-gray-600 transition-transform ${isCollapsed ? 'rotate-0' : 'rotate-180'}`} />
        </div>
        {!isCollapsed && plans.length > 0 && (
          <div className="mt-2 space-y-2">
            {/* Show all subscription plans */}
            {plans.map((plan, idx) => (
              <button
                key={plan.id}
        onClick={() => handleSubscribe(plan)}
        disabled={loading}
        className="w-full text-white py-1 px-4 rounded-full font-bold text-xs flex items-center justify-between transition-all duration-300"
        style={{
          background: '#00a8ff',
          boxShadow: `
            0 3px 6px rgba(0, 0, 0, 0.3),
            0 1px 3px rgba(0, 0, 0, 0.2),
            inset 0 2px 4px rgba(255, 255, 255, 0.3),
            inset 0 -1px 2px rgba(0, 0, 0, 0.2)
          `,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          position: 'relative',
          overflow: 'hidden',
          transform: 'perspective(500px) rotateX(0deg)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `
            0 5px 12px rgba(0, 168, 255, 0.5),
            0 2px 6px rgba(0, 0, 0, 0.3),
            inset 0 3px 6px rgba(255, 255, 255, 0.4),
            inset 0 -2px 4px rgba(0, 0, 0, 0.25)
          `;
          e.currentTarget.style.transform = 'translateY(-1px) scale(1.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = `
            0 3px 6px rgba(0, 0, 0, 0.3),
            0 1px 3px rgba(0, 0, 0, 0.2),
            inset 0 2px 4px rgba(255, 255, 255, 0.3),
            inset 0 -1px 2px rgba(0, 0, 0, 0.2)
          `;
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'translateY(1px) scale(0.98)';
          e.currentTarget.style.boxShadow = `
            0 1px 3px rgba(0, 0, 0, 0.4),
            inset 0 1px 2px rgba(0, 0, 0, 0.3)
          `;
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px) scale(1.02)';
          e.currentTarget.style.boxShadow = `
            0 5px 12px rgba(0, 168, 255, 0.5),
            0 2px 6px rgba(0, 0, 0, 0.3),
            inset 0 3px 6px rgba(255, 255, 255, 0.4),
            inset 0 -2px 4px rgba(0, 0, 0, 0.25)
          `;
        }}
      >
        <span className="relative z-10 drop-shadow-sm">SUBSCRIBE</span>
        <span className="relative z-10 text-xs drop-shadow-sm">
          {plan.price === 0 ? 'Free' : `$${plan.price.toFixed(2)}`} / {plan.isRecurring ? 'Monthly' : `${plan.intervalCount || plan.duration || 30} days`}
        </span>
      </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

