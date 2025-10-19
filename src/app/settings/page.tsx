'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import '@/styles/tab-navigation.css';
import { Card } from '@/components/ui/card';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AccountSettings from './components/AccountSettings';
import PrivacySettings from './components/PrivacySettings';
import NotificationSettings from './components/NotificationSettings';
// import PaymentSettings from './components/PaymentSettings'; // REMOVED - No payment system implemented
import SecuritySettings from './components/SecuritySettings';
import CreatorVerificationSettings from './components/CreatorVerificationSettings';
import BlockSettingsTab from '../creator/dashboard/components/BlockSettingsTab';

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
        {/* Navigation Tabs */}
        <div className="flex justify-center mb-6">
          <div className="tab-container">
            <input 
              type="radio" 
              name="tab" 
              id="tab1" 
              className="tab tab--1" 
              checked={activeTab === 'account'}
              onChange={() => setActiveTab('account')}
            />
            <label className="tab_label" htmlFor="tab1">Account</label>

            <input 
              type="radio" 
              name="tab" 
              id="tab2" 
              className="tab tab--2" 
              checked={activeTab === 'privacy'}
              onChange={() => setActiveTab('privacy')}
            />
            <label className="tab_label" htmlFor="tab2">Privacy</label>

            <input 
              type="radio" 
              name="tab" 
              id="tab3" 
              className="tab tab--3" 
              checked={activeTab === 'notifications'}
              onChange={() => setActiveTab('notifications')}
            />
            <label className="tab_label" htmlFor="tab3">Notifications</label>

            <input 
              type="radio" 
              name="tab" 
              id="tab4" 
              className="tab tab--4" 
              checked={activeTab === 'security'}
              onChange={() => setActiveTab('security')}
            />
            <label className="tab_label" htmlFor="tab4">Security</label>

            <input 
              type="radio" 
              name="tab" 
              id="tab5" 
              className="tab tab--5" 
              checked={activeTab === 'creator'}
              onChange={() => setActiveTab('creator')}
            />
            <label className="tab_label" htmlFor="tab5">Creator</label>

            <input 
              type="radio" 
              name="tab" 
              id="tab6" 
              className="tab tab--6" 
              checked={activeTab === 'block'}
              onChange={() => setActiveTab('block')}
            />
            <label className="tab_label" htmlFor="tab6">Block</label>

            <div className="indicator"></div>
          </div>
        </div>

        {/* Tab Contents */}
        {activeTab === 'account' && (
          <Card className="p-6">
            <AccountSettings />
          </Card>
        )}

        {activeTab === 'privacy' && (
          <Card className="p-6">
            <PrivacySettings />
          </Card>
        )}

        {activeTab === 'notifications' && (
          <Card className="p-6">
            <NotificationSettings />
          </Card>
        )}

        {activeTab === 'security' && (
          <Card className="p-6">
            <SecuritySettings />
          </Card>
        )}

        {activeTab === 'creator' && (
          <Card className="p-6">
            <CreatorVerificationSettings />
          </Card>
        )}

        {activeTab === 'block' && (
          <Card className="p-6">
            <BlockSettingsTab />
          </Card>
        )}
      </div>
    </div>
  );
} 