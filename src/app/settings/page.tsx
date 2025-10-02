'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AccountSettings from './components/AccountSettings';
import PrivacySettings from './components/PrivacySettings';
import NotificationSettings from './components/NotificationSettings';
import PaymentSettings from './components/PaymentSettings';
import SecuritySettings from './components/SecuritySettings';
import CreatorVerificationSettings from './components/CreatorVerificationSettings';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserProfile() {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserProfile();
  }, [user]);

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-500">Manage your account settings and preferences</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="creator">Creator</TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <Card className="p-6">
              <AccountSettings />
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card className="p-6">
              <PrivacySettings />
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="p-6">
              <NotificationSettings />
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card className="p-6">
              <PaymentSettings />
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="p-6">
              <SecuritySettings />
            </Card>
          </TabsContent>

          <TabsContent value="creator">
            <Card className="p-6">
              <CreatorVerificationSettings />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 