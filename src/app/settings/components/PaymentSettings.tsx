'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, CreditCard, Plus } from 'lucide-react';

export default function PaymentSettings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([
    {
      id: '1',
      type: 'card',
      last4: '4242',
      brand: 'Visa',
      expiry: '12/24',
      isDefault: true,
    },
  ]);

  const [subscription, setSubscription] = useState({
    plan: 'free',
    status: 'active',
    nextBillingDate: '2024-05-01',
  });

  const handleAddPaymentMethod = () => {
    // Implement payment method addition logic
    toast.info('Payment method addition coming soon');
  };

  const handleRemovePaymentMethod = (id: string) => {
    setPaymentMethods(prev => prev.filter(method => method.id !== id));
    toast.success('Payment method removed');
  };

  const handleSetDefaultPaymentMethod = (id: string) => {
    setPaymentMethods(prev =>
      prev.map(method => ({
        ...method,
        isDefault: method.id === id,
      }))
    );
    toast.success('Default payment method updated');
  };

  const handleUpdateSubscription = async (plan: string) => {
    setIsLoading(true);
    try {
      // Implement subscription update logic
      setSubscription(prev => ({ ...prev, plan }));
      toast.success('Subscription updated successfully');
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Failed to update subscription');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Payment Methods</h2>
        
        <div className="space-y-4">
          {paymentMethods.map(method => (
            <div
              key={method.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center space-x-4">
                <CreditCard className="h-6 w-6 text-gray-500" />
                <div>
                  <p className="font-medium">
                    {method.brand} ending in {method.last4}
                  </p>
                  <p className="text-sm text-gray-500">
                    Expires {method.expiry}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {!method.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetDefaultPaymentMethod(method.id)}
                  >
                    Set as Default
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemovePaymentMethod(method.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleAddPaymentMethod}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Payment Method
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Subscription</h2>
        
        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Current Plan</p>
                <p className="text-sm text-gray-500">
                  {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
                </p>
              </div>
              <Select
                value={subscription.plan}
                onValueChange={handleUpdateSubscription}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Next billing date: {subscription.nextBillingDate}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Billing History</h2>
        
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            Your billing history will appear here once you have active subscriptions.
          </p>
        </div>
      </div>
    </div>
  );
} 