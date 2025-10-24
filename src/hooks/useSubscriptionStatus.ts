import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SubscriptionStatus {
  isSubscriber: boolean;
  isPaidSubscriber: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to check if the current user is subscribed to a specific creator
 * @param creatorId - The ID of the creator to check subscription for
 * @returns SubscriptionStatus object with subscription information
 */
export function useSubscriptionStatus(creatorId: string | null): SubscriptionStatus {
  const { user } = useAuth();
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [isPaidSubscriber, setIsPaidSubscriber] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!user || !creatorId) {
        setIsSubscriber(false);
        setIsPaidSubscriber(false);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Check subscription document
        const subscriptionRef = doc(db, 'subscriptions', `${user.uid}_${creatorId}`);
        const subscriptionDoc = await getDoc(subscriptionRef);

        if (!subscriptionDoc.exists()) {
          setIsSubscriber(false);
          setIsPaidSubscriber(false);
          setIsLoading(false);
          return;
        }

        const subscriptionData = subscriptionDoc.data();
        const now = new Date();
        
        // Check if subscription is active or cancelled but not expired
        const isActive = subscriptionData?.status === 'active';
        const isCancelledButValid = subscriptionData?.status === 'cancelled' &&
          subscriptionData?.endDate &&
          (subscriptionData.endDate.toDate ? subscriptionData.endDate.toDate() : new Date(subscriptionData.endDate)).getTime() > now.getTime();
        
        const hasValidSubscription = isActive || isCancelledButValid;
        
        if (hasValidSubscription) {
          setIsSubscriber(true);
          
          // Check if it's a paid subscription
          if (subscriptionData?.planId) {
            const planRef = doc(db, 'subscriptionPlans', subscriptionData.planId);
            const planDoc = await getDoc(planRef);
            
            if (planDoc.exists()) {
              const planData = planDoc.data();
              setIsPaidSubscriber(planData?.price > 0);
            } else {
              setIsPaidSubscriber(false);
            }
          } else {
            setIsPaidSubscriber(false);
          }
        } else {
          setIsSubscriber(false);
          setIsPaidSubscriber(false);
        }
      } catch (err) {
        console.error('Error checking subscription status:', err);
        setError(err instanceof Error ? err.message : 'Failed to check subscription status');
        setIsSubscriber(false);
        setIsPaidSubscriber(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscriptionStatus();
  }, [user, creatorId]);

  return {
    isSubscriber,
    isPaidSubscriber,
    isLoading,
    error
  };
}
