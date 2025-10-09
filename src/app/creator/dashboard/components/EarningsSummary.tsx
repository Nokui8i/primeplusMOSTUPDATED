import { Card } from '@/components/ui/card';
import { FiDollarSign, FiCreditCard, FiGift } from 'react-icons/fi';

interface EarningsSummaryProps {
  subscriptionEarnings: number;
  tipEarnings: number;
  recentSubscriptionEarnings: number;
  recentTipEarnings: number;
}

export default function EarningsSummary({
  subscriptionEarnings,
  tipEarnings,
  recentSubscriptionEarnings,
  recentTipEarnings,
}: EarningsSummaryProps) {
  const totalEarnings = subscriptionEarnings + tipEarnings;
  const recentTotalEarnings = recentSubscriptionEarnings + recentTipEarnings;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4" style={{ color: 'rgb(26, 26, 26)' }}>Earnings Summary</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col items-center justify-center">
          <div className="flex flex-row items-center gap-2">
            <FiDollarSign className="w-4 h-4" style={{ color: 'rgb(91, 173, 255)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgb(26, 26, 26)' }}>Total Earnings</span>
          </div>
          <span className="text-base font-bold mt-1" style={{ color: 'rgb(26, 26, 26)' }}>${totalEarnings.toFixed(2)}</span>
          <div className="mt-4 flex items-center text-sm text-green-600 justify-center">
            <span>+${recentTotalEarnings.toFixed(2)} this week</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="flex flex-row items-center gap-2">
            <FiCreditCard className="w-4 h-4" style={{ color: 'rgb(91, 173, 255)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgb(26, 26, 26)' }}>Subscription Earnings</span>
          </div>
          <span className="text-base font-bold mt-1" style={{ color: 'rgb(26, 26, 26)' }}>${subscriptionEarnings.toFixed(2)}</span>
          <div className="mt-4 flex items-center text-sm text-green-600 justify-center">
            <span>+${recentSubscriptionEarnings.toFixed(2)} this week</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="flex flex-row items-center gap-2">
            <FiGift className="w-4 h-4" style={{ color: 'rgb(91, 173, 255)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgb(26, 26, 26)' }}>Tip Earnings</span>
          </div>
          <span className="text-base font-bold mt-1" style={{ color: 'rgb(26, 26, 26)' }}>${tipEarnings.toFixed(2)}</span>
          <div className="mt-4 flex items-center text-sm text-green-600 justify-center">
            <span>+${recentTipEarnings.toFixed(2)} this week</span>
          </div>
        </div>
      </div>
    </Card>
  );
} 