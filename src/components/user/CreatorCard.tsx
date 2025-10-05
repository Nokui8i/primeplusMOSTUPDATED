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
    <div className="w-full mb-4" style={{
      background: 'white',
      borderRadius: '17px 17px 27px 27px',
      boxShadow: '0px 187px 75px rgba(0, 0, 0, 0.01), 0px 105px 63px rgba(0, 0, 0, 0.05), 0px 47px 47px rgba(0, 0, 0, 0.09), 0px 12px 26px rgba(0, 0, 0, 0.1), 0px 0px 0px rgba(0, 0, 0, 0.1)'
    }}>
      {/* Cover Photo with gradient overlay and overlaid content */}
      <div className="relative h-32 w-full overflow-hidden" style={{ 
        borderRadius: '17px 17px 27px 27px'
      }}>
        <img
          src={coverPhotoUrl || '/default-avatar.png'}
          alt={`${displayName || username}'s cover`}
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
        
        {/* Profile Photo and Names positioned over cover photo */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3"> {/* PADDING: px-3 pb-3 */}
          <div className="flex items-start">
            <img
              src={photoURL || '/default-avatar.png'}
              alt={displayName || username || 'User'}
              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md flex-shrink-0" /* PADDING: w-16 h-16 (64px) */
              style={{ marginTop: '-20px' }} /* PADDING: marginTop: -20px */
            />
            <div className="flex-1 min-w-0 ml-2"> {/* PADDING: ml-2 (8px) */}
              <Link href={`/${username || userId}`} className="block hover:opacity-80 transition-opacity">
                <div style={{ 
                  color: '#ffffff', 
                  fontWeight: '700',
                  fontSize: '16px',
                  lineHeight: '1.2',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                }}>
                  {displayName || username || 'User'}
                </div>
                <div style={{ 
                  color: '#d1d5db',
                  fontSize: '12px',
                  lineHeight: '1.2',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                }}>
                  @{username || 'username'}
                </div>
              </Link>
            </div>
          </div>
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