import Link from 'next/link';
import { useFollowStats } from '@/components/FollowButton';
import { useState, useEffect } from 'react';
import PlansModal from '@/components/creator/PlansModal';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface CreatorCardProps {
  userId: string;
  username?: string;
  displayName?: string;
  photoURL?: string;
  coverPhotoUrl?: string;
  isSimpleCard?: boolean; // If true, clicking card navigates directly to profile (for sidebar)
}

export function CreatorCard({
  userId,
  username,
  displayName,
  photoURL,
  coverPhotoUrl,
  isSimpleCard = false,
}: CreatorCardProps) {
  const { stats } = useFollowStats(userId);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const router = useRouter();


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
        
        // Skip API call for demo users
        if (userId.startsWith('demo')) {
          setIsSubscribed(true);
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
    <div 
      className="w-full mb-4"
      style={{
        background: 'white',
        borderRadius: isMobile ? '12px' : '17px 17px 27px 27px',
        boxShadow: isMobile 
          ? '0px 2px 8px rgba(0, 0, 0, 0.08), 0px 1px 3px rgba(0, 0, 0, 0.12)'
          : '0px 187px 75px rgba(0, 0, 0, 0.01), 0px 105px 63px rgba(0, 0, 0, 0.05), 0px 47px 47px rgba(0, 0, 0, 0.09), 0px 12px 26px rgba(0, 0, 0, 0.1), 0px 0px 0px rgba(0, 0, 0, 0.1)',
        minWidth: '0',
        flexShrink: 1
      }}
    >
      {/* Cover Photo with gradient overlay and overlaid content */}
      <div 
        className={`relative w-full overflow-hidden ${isMobile ? 'h-24' : 'h-32'}`} 
        style={{ 
          borderRadius: isMobile ? '12px 12px 0 0' : '17px 17px 27px 27px',
          minHeight: isMobile ? '96px' : '128px',
          width: '100%',
          position: 'relative'
        }}
      >
        {coverPhotoUrl ? (
          <img
            src={coverPhotoUrl}
            alt={`${displayName || username}'s cover`}
            className="w-full h-full object-cover"
            style={{ 
              display: 'block', 
              minHeight: '100%',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0
            }}
            onError={(e) => {
              // Fallback to default avatar if cover photo fails to load
              (e.target as HTMLImageElement).src = '/default-avatar.png';
            }}
          />
        ) : (
          <img
            src="/default-avatar.png"
            alt={`${displayName || username}'s cover`}
            className="w-full h-full object-cover"
            style={{ 
              display: 'block', 
              minHeight: '100%',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0
            }}
          />
        )}
        {/* Dark gradient overlay for text visibility */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, transparent 20%, rgba(0, 0, 0, 0.3) 60%, rgba(0, 0, 0, 0.8) 100%)',
            borderRadius: '17px 17px 27px 27px'
          }}
        />
        
        {/* Profile Photo and Names positioned over cover photo */}
        <div className={`absolute bottom-0 left-0 right-0 ${isMobile ? 'px-2 pb-2' : 'px-3 pb-3'}`}>
          <div className="flex items-start">
            <img
              src={photoURL || '/default-avatar.png'}
              alt={displayName || username || 'User'}
              className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} rounded-full object-cover border-2 border-white shadow-md flex-shrink-0`}
              style={{ marginTop: isMobile ? '-16px' : '-20px' }}
            />
            <div className="flex-1 min-w-0 ml-2">
              {isSimpleCard ? (
                // Simple card: clickable names that navigate to profile
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('CreatorCard: Navigating to profile for userId:', userId);
                    console.log('CreatorCard: Username:', username);
                    console.log('CreatorCard: Display Name:', displayName);
                    // Use userId directly as it's the Firebase UID
                    router.push(`/profile/${userId}`);
                  }}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div style={{ 
                    color: '#ffffff', 
                    fontWeight: '700',
                    fontSize: isMobile ? '14px' : '16px',
                    lineHeight: '1.2',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                  }}>
                    {displayName || username || 'User'}
                  </div>
                  <div style={{ 
                    color: '#d1d5db',
                    fontSize: isMobile ? '11px' : '12px',
                    lineHeight: '1.2',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                  }}>
                    @{username || 'username'}
                  </div>
                </div>
              ) : (
                // Full card: show dropdown menu
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="block hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <div style={{ 
                        color: '#ffffff', 
                        fontWeight: '700',
                        fontSize: isMobile ? '14px' : '16px',
                        lineHeight: '1.2',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                      }}>
                        {displayName || username || 'User'}
                      </div>
                      <div style={{ 
                        color: '#d1d5db',
                        fontSize: isMobile ? '11px' : '12px',
                        lineHeight: '1.2',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                      }}>
                        @{username || 'username'}
                      </div>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    className="w-28 bg-white border-0 overflow-hidden p-0"
                    style={{
                      borderRadius: '12px',
                      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                    }}
                  >
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/profile/${userId}`);
                      }}
                      className="cursor-pointer text-xs py-1.5 px-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200"
                      style={{
                        fontWeight: '500',
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Visit Profile
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
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