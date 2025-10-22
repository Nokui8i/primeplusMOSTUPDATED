'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Label } from '@/components/ui/label';
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
    
    // Update UI immediately for instant feedback
    setNotificationSettings(prev => ({
      ...prev,
      push: {
        ...prev.push,
        [type]: value,
      },
    }));
    
    // Save to database in background
    try {
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

      toast.success('Notification settings updated');
    } catch (error) {
      console.error('[ERROR] Failed to update notification settings:', error);
      // Revert the UI change on error
      setNotificationSettings(prev => ({
        ...prev,
        push: {
          ...prev.push,
          [type]: !value,
        },
      }));
      toast.error('Failed to update notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Push Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg" style={{
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(200, 200, 200, 0.3)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}>
            <div className="space-y-0.5">
              <div className="font-normal text-gray-800 text-sm">Likes</div>
              <p className="text-xs text-gray-600">
                Get notified when someone likes your posts
              </p>
            </div>
            <label className={`flex items-center ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={notificationSettings.push.likes}
                onChange={(e) => {
                  e.stopPropagation();
                  handleNotificationChange('likes', e.target.checked);
                }}
                disabled={isLoading}
                className="checkbox"
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg" style={{
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(200, 200, 200, 0.3)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}>
            <div className="space-y-0.5">
              <div className="font-normal text-gray-800 text-sm">Comments</div>
              <p className="text-xs text-gray-600">
                Get notified when someone comments on your posts
              </p>
            </div>
            <label className={`flex items-center ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={notificationSettings.push.comment}
                onChange={(e) => {
                  e.stopPropagation();
                  handleNotificationChange('comment', e.target.checked);
                }}
                disabled={isLoading}
                className="checkbox"
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg" style={{
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(200, 200, 200, 0.3)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}>
            <div className="space-y-0.5">
              <div className="font-normal text-gray-800 text-sm">Mentions</div>
              <p className="text-xs text-gray-600">
                Get notified when someone mentions you
              </p>
            </div>
            <label className={`flex items-center ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={notificationSettings.push.mention}
                onChange={(e) => {
                  e.stopPropagation();
                  handleNotificationChange('mention', e.target.checked);
                }}
                disabled={isLoading}
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