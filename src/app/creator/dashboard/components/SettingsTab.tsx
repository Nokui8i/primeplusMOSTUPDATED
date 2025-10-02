'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { FiSave, FiUpload, FiLink } from 'react-icons/fi';
import { useAuth } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface CreatorSettings {
  displayName: string;
  bio: string;
  website: string;
  socialLinks: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
  };
  notifications: {
    newSubscriber: boolean;
    newComment: boolean;
    newLike: boolean;
    marketing: boolean;
  };
  privacy: {
    showSubscriberCount: boolean;
    allowMessages: boolean;
    showOnlineStatus: boolean;
  };
}

export default function SettingsTab() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CreatorSettings>({
    displayName: '',
    bio: '',
    website: '',
    socialLinks: {},
    notifications: {
      newSubscriber: true,
      newComment: true,
      newLike: true,
      marketing: false,
    },
    privacy: {
      showSubscriberCount: true,
      allowMessages: true,
      showOnlineStatus: true,
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user?.uid) return;

      try {
        const creatorDoc = await getDoc(doc(db, 'creators', user.uid));
        if (creatorDoc.exists()) {
          setSettings(creatorDoc.data() as CreatorSettings);
        }
      } catch (error) {
        console.error('Error fetching creator settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [user?.uid]);

  const handleSave = async () => {
    if (!user?.uid) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'creators', user.uid), settings as any);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Profile Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <Input
              value={settings.displayName}
              onChange={(e) =>
                setSettings({ ...settings, displayName: e.target.value })
              }
              placeholder="Your display name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bio
            </label>
            <textarea
              value={settings.bio}
              onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Tell your subscribers about yourself"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <Input
              value={settings.website}
              onChange={(e) =>
                setSettings({ ...settings, website: e.target.value })
              }
              placeholder="https://your-website.com"
            />
          </div>
        </div>
      </Card>

      {/* Social Links */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Social Links</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Twitter
            </label>
            <Input
              value={settings.socialLinks.twitter || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  socialLinks: {
                    ...settings.socialLinks,
                    twitter: e.target.value,
                  },
                })
              }
              placeholder="https://twitter.com/your-handle"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instagram
            </label>
            <Input
              value={settings.socialLinks.instagram || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  socialLinks: {
                    ...settings.socialLinks,
                    instagram: e.target.value,
                  },
                })
              }
              placeholder="https://instagram.com/your-handle"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              YouTube
            </label>
            <Input
              value={settings.socialLinks.youtube || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  socialLinks: {
                    ...settings.socialLinks,
                    youtube: e.target.value,
                  },
                })
              }
              placeholder="https://youtube.com/your-channel"
            />
          </div>
        </div>
      </Card>

      {/* Notification Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Notification Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">New Subscriber Notifications</p>
              <p className="text-sm text-gray-500">
                Get notified when someone subscribes to your content
              </p>
            </div>
            <Switch
              checked={settings.notifications.newSubscriber}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    newSubscriber: checked,
                  },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">New Comment Notifications</p>
              <p className="text-sm text-gray-500">
                Get notified when someone comments on your content
              </p>
            </div>
            <Switch
              checked={settings.notifications.newComment}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    newComment: checked,
                  },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">New Like Notifications</p>
              <p className="text-sm text-gray-500">
                Get notified when someone likes your content
              </p>
            </div>
            <Switch
              checked={settings.notifications.newLike}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    newLike: checked,
                  },
                })
              }
            />
          </div>
        </div>
      </Card>

      {/* Privacy Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Privacy Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Show Subscriber Count</p>
              <p className="text-sm text-gray-500">
                Display your total number of subscribers publicly
              </p>
            </div>
            <Switch
              checked={settings.privacy.showSubscriberCount}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  privacy: {
                    ...settings.privacy,
                    showSubscriberCount: checked,
                  },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Allow Direct Messages</p>
              <p className="text-sm text-gray-500">
                Let subscribers send you direct messages
              </p>
            </div>
            <Switch
              checked={settings.privacy.allowMessages}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  privacy: {
                    ...settings.privacy,
                    allowMessages: checked,
                  },
                })
              }
            />
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center space-x-2"
        >
          <FiSave className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
        </Button>
      </div>
    </div>
  );
} 