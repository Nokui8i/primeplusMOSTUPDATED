'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Lock, Globe } from 'lucide-react';

export default function PrivacySettings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    onlineStatus: 'everyone',
    allowTagging: true,
    showActivityStatus: true,
    // allowProfileDiscovery: true,
  });

  useEffect(() => {
    const loadPrivacySettings = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.privacy) {
            setPrivacySettings(prev => ({
              ...prev,
              ...userData.privacy
            }));
          }
        }
      } catch (error) {
        console.error('Error loading privacy settings:', error);
        toast.error('Failed to load privacy settings');
      }
    };

    loadPrivacySettings();
  }, [user]);

  const handlePrivacySettingChange = async (setting: string, value: string | boolean) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          [`privacy.${setting}`]: value,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, {
          [`privacy.${setting}`]: value,
          updatedAt: serverTimestamp(),
        });
      }
      setPrivacySettings(prev => ({ ...prev, [setting]: value }));
      toast.success('Privacy settings updated');
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      toast.error('Failed to update privacy settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Interactions</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow Tagging</Label>
              <p className="text-sm text-gray-500">
                Let others tag you in posts and comments
              </p>
            </div>
            <Switch
              checked={privacySettings.allowTagging}
              onCheckedChange={value => handlePrivacySettingChange('allowTagging', value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Activity & Discovery</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Activity Status</Label>
              <p className="text-sm text-gray-500">
                Show when you're active on the platform
              </p>
            </div>
            <Switch
              checked={privacySettings.showActivityStatus}
              onCheckedChange={value => handlePrivacySettingChange('showActivityStatus', value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 