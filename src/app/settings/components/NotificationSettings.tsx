'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function NotificationSettings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    push: {
      likes: true,
      comment: true,
      mention: true
    }
  });

  useEffect(() => {
    const loadNotificationSettings = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.notifications?.push) {
            setNotificationSettings(prev => ({
              ...prev,
              push: {
                ...prev.push,
                ...userData.notifications.push
              }
            }));
          }
        }
      } catch (error) {
        console.error('[ERROR] Failed to load notification settings:', error);
        toast.error('Failed to load notification settings');
      }
    };

    loadNotificationSettings();
  }, [user]);

  const handleNotificationChange = async (
    type: 'likes' | 'comment' | 'mention',
    value: boolean
  ) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      
      // Update Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          [`notifications.push.${type}`]: value,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, {
          [`notifications.push.${type}`]: value,
          updatedAt: serverTimestamp(),
        });
      }

      // Update local state
      setNotificationSettings(prev => ({
        ...prev,
        push: {
          ...prev.push,
          [type]: value,
        },
      }));

      toast.success('Notification settings updated');
    } catch (error) {
      console.error('[ERROR] Failed to update notification settings:', error);
      toast.error('Failed to update notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Push Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Likes</Label>
              <p className="text-sm text-gray-500">
                Get notified when someone likes your posts
              </p>
            </div>
            <Switch
              checked={notificationSettings.push.likes}
              onCheckedChange={value => handleNotificationChange('likes', value)}
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Comments</Label>
              <p className="text-sm text-gray-500">
                Get notified when someone comments on your posts
              </p>
            </div>
            <Switch
              checked={notificationSettings.push.comment}
              onCheckedChange={value => handleNotificationChange('comment', value)}
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Mentions</Label>
              <p className="text-sm text-gray-500">
                Get notified when someone mentions you
              </p>
            </div>
            <Switch
              checked={notificationSettings.push.mention}
              onCheckedChange={value => handleNotificationChange('mention', value)}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 