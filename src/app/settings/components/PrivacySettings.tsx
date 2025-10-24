'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Eye, Lock, Globe } from 'lucide-react';

export default function PrivacySettings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    onlineStatus: 'everyone',
    allowTagging: true,
    showActivityStatus: true,
    allowComments: true, // Simple boolean for normal users
    profileVisibility: 'public' as 'public' | 'subscribers_only',
    // allowProfileDiscovery: true,
  });

  useEffect(() => {
    const loadPrivacySettings = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Check if user is a creator
          const hasCreatorRole = userData.role === 'creator' || userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner';
          setIsCreator(hasCreatorRole);
          
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
    
    // Update UI immediately for instant feedback
    setPrivacySettings(prev => ({ ...prev, [setting]: value }));
    
    // Save to database in background
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
      toast.success('Privacy settings updated');
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      // Revert the UI change on error
      setPrivacySettings(prev => ({ ...prev, [setting]: !value }));
      toast.error('Failed to update privacy settings');
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Interactions</h2>
        
        <div className="space-y-4">
          {/* Only show simple comment settings for non-creators */}
          {!isCreator && (
            <div className="flex items-center justify-between p-4 rounded-lg" style={{
              background: 'rgba(255, 255, 255, 0.6)',
              border: '1px solid rgba(200, 200, 200, 0.3)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            }}>
              <div className="space-y-0.5 flex-1 pr-4">
                <div className="font-normal text-gray-800 text-sm">Allow Comments</div>
                <p className="text-xs text-gray-600">
                  Let others comment on your posts (can be overridden per post)
                </p>
              </div>
              <label className="flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={privacySettings.allowComments}
                  onChange={(e) => {
                    e.stopPropagation();
                    handlePrivacySettingChange('allowComments', e.target.checked);
                  }}
                  className="checkbox"
                />
                <span className="slider"></span>
              </label>
            </div>
          )}

          {/* Show message for creators about advanced comment settings */}
          {isCreator && (
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <div className="space-y-1">
                <div className="font-normal text-gray-800 text-sm">Comment Settings</div>
                <p className="text-xs text-gray-600">
                  As a creator, you have advanced comment settings available in your Creator Dashboard. 
                  You can control who can comment (everyone, subscribers only, paid subscribers only, or no comments).
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 rounded-lg" style={{
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(200, 200, 200, 0.3)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}>
            <div className="space-y-0.5 flex-1 pr-4">
              <div className="font-normal text-gray-800 text-sm">Allow Tagging</div>
              <p className="text-xs text-gray-600">
                Let others tag you in posts and comments
              </p>
            </div>
            <label className="flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={privacySettings.allowTagging}
                onChange={(e) => {
                  e.stopPropagation();
                  handlePrivacySettingChange('allowTagging', e.target.checked);
                }}
                className="checkbox"
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Profile Visibility</h2>
        
        <div className="space-y-4">
          <div className="p-4 rounded-lg" style={{
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(200, 200, 200, 0.3)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="font-normal text-gray-800 text-sm">Who can see your profile</div>
                <p className="text-xs text-gray-600">
                  Control who can view your profile and posts
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="profileVisibility"
                    value="public"
                    checked={privacySettings.profileVisibility === 'public'}
                    onChange={(e) => {
                      e.stopPropagation();
                      handlePrivacySettingChange('profileVisibility', e.target.value as 'public' | 'subscribers_only');
                    }}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-gray-600" />
                    <div>
                      <div className="text-sm font-medium text-gray-800">Public</div>
                      <div className="text-xs text-gray-600">Anyone can see your profile and posts</div>
                    </div>
                  </div>
                </label>
                
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="profileVisibility"
                    value="subscribers_only"
                    checked={privacySettings.profileVisibility === 'subscribers_only'}
                    onChange={(e) => {
                      e.stopPropagation();
                      handlePrivacySettingChange('profileVisibility', e.target.value as 'public' | 'subscribers_only');
                    }}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="flex items-center space-x-2">
                    <Lock className="h-4 w-4 text-gray-600" />
                    <div>
                      <div className="text-sm font-medium text-gray-800">Subscribers Only</div>
                      <div className="text-xs text-gray-600">Only your subscribers can see your profile and posts</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Activity & Discovery</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg" style={{
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(200, 200, 200, 0.3)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}>
            <div className="space-y-0.5 flex-1 pr-4">
              <div className="font-normal text-gray-800 text-sm">Activity Status</div>
              <p className="text-xs text-gray-600">
                Show when you're active on the platform
              </p>
            </div>
            <label className="flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={privacySettings.showActivityStatus}
                onChange={(e) => {
                  e.stopPropagation();
                  handlePrivacySettingChange('showActivityStatus', e.target.checked);
                }}
                className="checkbox"
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
} 