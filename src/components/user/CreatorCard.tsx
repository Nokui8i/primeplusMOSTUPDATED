import Link from 'next/link';
import { useFollowStats } from '@/components/FollowButton';
import { useState, useEffect } from 'react';
import PlansModal from '@/components/creator/PlansModal';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import axios from 'axios';
import { getAuth } from 'firebase/auth';

interface CreatorCardProps {
  userId: string;
  username?: string;
  displayName?: string;
  photoURL?: string;
  coverPhotoUrl?: string;
}

export function CreatorCard({
  userId,
  username,
  displayName,
  photoURL,
  coverPhotoUrl,
}: CreatorCardProps) {
  const { stats } = useFollowStats(userId);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const SUBSCRIPTIONS_API_URL = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || '';

  useEffect(() => {
    if (!userId) return;
    setPlansLoading(true);
    const fetchPlans = async () => {
      try {
        const q = query(
          collection(db, 'plans'),
          where('creatorId', '==', userId)
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
            creatorId: data.creatorId || userId
          };
        });
        setPlans(plansData);
      } catch (err) {
        setPlans([]);
      } finally {
        setPlansLoading(false);
      }
    };
    fetchPlans();

    // Check subscription status
    const checkSubscriptionStatus = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user || !userId) {
          setIsSubscribed(false);
          return;
        }
        const idToken = await user.getIdToken();
        const response = await axios.get(
          `${SUBSCRIPTIONS_API_URL}/to/${userId}/latest`,
          {
            headers: {
              Authorization: `Bearer ${idToken}`
            }
          }
        );
        // --- UPDATED LOGIC ---
        const now = Date.now();
        let expires = null;
        if (response.status === 200 && response.data && response.data.endDate) {
          expires = response.data.endDate._seconds
            ? new Date(response.data.endDate._seconds * 1000)
            : new Date(response.data.endDate);
        }
        const isActive = response.data.status === 'active';
        const isCancelledButValid = response.data.status === 'cancelled' && !!expires && expires.getTime() > now;
        setIsSubscribed(isActive || isCancelledButValid);
      } catch (error) {
        // If 404, user is not subscribed - this is a valid state
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setIsSubscribed(false);
          return;
        }
        // For other errors, log and set as not subscribed
        console.error('Error checking subscription status:', error);
        setIsSubscribed(false);
      }
    };
    checkSubscriptionStatus();
  }, [userId]);

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <img
            src={photoURL || '/default-avatar.png'}
            alt={displayName || username || 'User'}
            className="w-12 h-12 rounded-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/${username || userId}`} className="block">
            <p className="text-sm font-medium text-gray-900 truncate">
              {displayName || username}
            </p>
            <p className="text-xs text-gray-500 truncate">@{username}</p>
          </Link>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={() => setShowPlansModal(true)}
            className="rounded-md px-3 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {isSubscribed ? 'Subscribed' : 'Subscribe'}
          </button>
        </div>
      </div>
      <PlansModal
        open={showPlansModal}
        onClose={() => setShowPlansModal(false)}
        creatorId={userId}
        plans={plans}
        onSelectPlan={() => {
          setShowPlansModal(false);
          setIsSubscribed(true);
        }}
      />
    </div>
  );
} 