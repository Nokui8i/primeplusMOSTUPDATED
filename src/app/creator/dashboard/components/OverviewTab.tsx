'use client';

import { Card } from '@/components/ui/card';
import { FiUsers, FiEye, FiHeart, FiMessageSquare, FiTrendingUp, FiImage, FiBarChart2, FiSettings } from 'react-icons/fi';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import EarningsSummary from './EarningsSummary';
import { getCreatorEarnings } from '@/lib/services/tip.service';

interface Stats {
  totalSubscribers: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  recentSubscribers: number;
  recentViews: number;
}

interface OverviewTabProps {
  stats: Stats;
}

// Helper to format numbers compactly (e.g., 1.2K, 3.5M, 1B)
function formatNumberCompact(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export default function OverviewTab({ stats }: OverviewTabProps) {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState({
    subscriptionEarnings: 0,
    tipEarnings: 0,
    recentSubscriptionEarnings: 0,
    recentTipEarnings: 0,
  });

  useEffect(() => {
    async function fetchEarnings() {
      if (!user?.uid) return;

      // Calculate start of the week (Monday)
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      const weekStartTimestamp = Timestamp.fromDate(weekStart);

      // Get total earnings
      const { subscriptionEarnings, tipEarnings } = await getCreatorEarnings(user.uid);

      // Get recent earnings (this week)
      const recentSubscriptionsQuery = query(
        collection(db, 'subscriptions'),
        where('creatorId', '==', user.uid),
        where('status', '==', 'active'),
        where('createdAt', '>=', weekStartTimestamp)
      );
      const recentSubscriptionsSnap = await getDocs(recentSubscriptionsQuery);
      
      let recentSubscriptionEarnings = 0;
      for (const doc of recentSubscriptionsSnap.docs) {
        const data = doc.data();
        const planQuery = query(
          collection(db, 'plans'),
          where('id', '==', data.planId)
        );
        const planSnap = await getDocs(planQuery);
        if (!planSnap.empty) {
          const plan = planSnap.docs[0].data();
          recentSubscriptionEarnings += plan.price * 0.85; // 85% to creator
        }
      }

      // Get recent tips
      const recentTipsQuery = query(
        collection(db, 'tips'),
        where('creatorId', '==', user.uid),
        where('status', '==', 'completed'),
        where('createdAt', '>=', weekStartTimestamp)
      );
      const recentTipsSnap = await getDocs(recentTipsQuery);
      
      let recentTipEarnings = 0;
      for (const doc of recentTipsSnap.docs) {
        const data = doc.data();
        recentTipEarnings += data.amount * 0.85; // 85% to creator
      }

      setEarnings({
        subscriptionEarnings,
        tipEarnings,
        recentSubscriptionEarnings,
        recentTipEarnings,
      });
    }

    fetchEarnings();
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center">
            <div className="flex flex-row items-center gap-2">
              <FiUsers className="w-4 h-4" style={{ color: 'rgb(91, 173, 255)' }} />
              <span className="text-xs font-medium" style={{ color: 'rgb(26, 26, 26)' }}>Total Subscribers</span>
            </div>
            <span className="text-base font-bold" style={{ color: 'rgb(26, 26, 26)' }}>{formatNumberCompact(stats.totalSubscribers)}</span>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 justify-center">
            <FiTrendingUp className="w-4 h-4 mr-1" />
            <span>+{stats.recentSubscribers} this week</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col items-center justify-center">
            <div className="flex flex-row items-center gap-2">
              <FiEye className="w-4 h-4" style={{ color: 'rgb(91, 173, 255)' }} />
              <span className="text-xs font-medium" style={{ color: 'rgb(26, 26, 26)' }}>Total Views</span>
            </div>
            <span className="text-base font-bold" style={{ color: 'rgb(26, 26, 26)' }}>{formatNumberCompact(stats.totalViews)}</span>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 justify-center">
            <FiTrendingUp className="w-4 h-4 mr-1" />
            <span>+{stats.recentViews} this week</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col items-center justify-center">
            <div className="flex flex-row items-center gap-2">
              <FiHeart className="w-4 h-4" style={{ color: 'rgb(91, 173, 255)' }} />
              <span className="text-xs font-medium" style={{ color: 'rgb(26, 26, 26)' }}>Total Likes</span>
            </div>
            <span className="text-base font-bold" style={{ color: 'rgb(26, 26, 26)' }}>{formatNumberCompact(stats.totalLikes)}</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col items-center justify-center">
            <div className="flex flex-row items-center gap-2">
              <FiMessageSquare className="w-4 h-4" style={{ color: 'rgb(91, 173, 255)' }} />
              <span className="text-xs font-medium" style={{ color: 'rgb(26, 26, 26)' }}>Total Comments</span>
            </div>
            <span className="text-base font-bold" style={{ color: 'rgb(26, 26, 26)' }}>{formatNumberCompact(stats.totalComments)}</span>
          </div>
        </Card>
      </div>

      {/* Earnings Summary */}
      <EarningsSummary {...earnings} />

      {/* Recent Activity */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'rgb(26, 26, 26)' }}>Recent Activity</h2>
        <div className="space-y-4">
          {/* TODO: Add recent activity list */}
          <p className="text-gray-500 text-sm">No recent activity to show</p>
        </div>
      </Card>
    </div>
  );
} 