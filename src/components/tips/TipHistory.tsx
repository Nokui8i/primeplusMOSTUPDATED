'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { getCreatorTipsPaginated, getTopTippers } from '@/lib/services/tip.service';
import { Tip } from '@/types/tip';
import { formatDistanceToNow } from 'date-fns';
import { Gift, TrendingUp, User, DollarSign } from 'lucide-react';
import { UserAvatar } from '@/components/user/UserAvatar';
import { collection, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface TipHistoryProps {
  creatorId: string;
}

export function TipHistory({ creatorId }: TipHistoryProps) {
  const [tips, setTips] = useState<Tip[]>([]);
  const [topTippers, setTopTippers] = useState<Array<{
    tipperId: string;
    totalAmount: number;
    tipCount: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [tipperProfiles, setTipperProfiles] = useState<Record<string, { displayName: string; username: string; photoURL?: string }>>({});

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [tipsData, toppersData] = await Promise.all([
          getCreatorTipsPaginated(creatorId, 20),
          getTopTippers(creatorId, 10),
        ]);

        setTips(tipsData);
        setTopTippers(toppersData);

        // Fetch tipper profiles
        const tipperIds = [...new Set([
          ...tipsData.map(t => t.tipperId),
          ...toppersData.map(t => t.tipperId)
        ])];

        const profiles: Record<string, any> = {};
        for (const tipperId of tipperIds) {
          try {
            const userQuery = query(collection(db, 'users'), where('uid', '==', tipperId));
            const userSnap = await getDocs(userQuery);
            if (!userSnap.empty) {
              const userData = userSnap.docs[0].data();
              profiles[tipperId] = {
                displayName: userData.displayName || userData.username || 'Anonymous',
                username: userData.username || tipperId,
                photoURL: userData.photoURL,
              };
            }
          } catch (error) {
            console.error(`Error fetching profile for ${tipperId}:`, error);
          }
        }
        setTipperProfiles(profiles);
      } catch (error) {
        console.error('Error fetching tip data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [creatorId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  const totalTips = tips.reduce((sum, tip) => sum + tip.amount, 0);
  const creatorEarnings = totalTips * 0.85; // 85% to creator

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-pink-100 rounded-full">
              <Gift className="w-6 h-6 text-pink-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Tips</p>
              <p className="text-2xl font-bold">{tips.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold">${totalTips.toFixed(2)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Your Earnings (85%)</p>
              <p className="text-2xl font-bold text-green-600">${creatorEarnings.toFixed(2)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tips */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-500" />
            Recent Tips
          </h3>
          
          {tips.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tips received yet</p>
          ) : (
            <div className="space-y-4">
              {tips.map((tip) => {
                const profile = tipperProfiles[tip.tipperId];
                const tipDate = tip.createdAt?.toDate ? tip.createdAt.toDate() : new Date(tip.createdAt as any);
                
                return (
                  <div key={tip.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <UserAvatar
                      userId={tip.tipperId}
                      displayName={profile?.displayName || 'Anonymous'}
                      photoURL={profile?.photoURL}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">
                          {profile?.displayName || 'Anonymous'}
                        </p>
                        <span className="text-sm font-semibold text-green-600">
                          ${tip.amount.toFixed(2)}
                        </span>
                      </div>
                      {tip.message && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{tip.message}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>{formatDistanceToNow(tipDate, { addSuffix: true })}</span>
                        {tip.context && (
                          <>
                            <span>•</span>
                            <span className="capitalize">
                              {tip.context.type}
                              {tip.context.mediaType && ` (${tip.context.mediaType})`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Top Tippers */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            Top Supporters
          </h3>
          
          {topTippers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No supporters yet</p>
          ) : (
            <div className="space-y-3">
              {topTippers.map((tipper, index) => {
                const profile = tipperProfiles[tipper.tipperId];
                
                return (
                  <div
                    key={tipper.tipperId}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {index + 1}
                    </div>
                    
                    <UserAvatar
                      userId={tipper.tipperId}
                      displayName={profile?.displayName || 'Anonymous'}
                      photoURL={profile?.photoURL}
                      size="sm"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {profile?.displayName || 'Anonymous'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {tipper.tipCount} tip{tipper.tipCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        ${tipper.totalAmount.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        ${(tipper.totalAmount * 0.85).toFixed(2)} earned
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

