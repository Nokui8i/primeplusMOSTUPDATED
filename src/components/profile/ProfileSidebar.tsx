'use client';

import { useState } from 'react';
import { UserProfile } from '@/lib/types/user';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FiMessageSquare, FiFlag, FiShare2 } from 'react-icons/fi';

interface ProfileSidebarProps {
  profile: UserProfile;
  isOwnProfile: boolean;
}

export function ProfileSidebar({ profile, isOwnProfile }: ProfileSidebarProps) {
  const [isReporting, setIsReporting] = useState(false);
  const { toast } = useToast();

  const handleMessage = async () => {
    try {
      // TODO: Implement message functionality
      toast({
        title: 'Opening chat',
        description: `Starting a conversation with ${profile.displayName || profile.username}`,
      });
    } catch (error) {
      console.error('Error opening chat:', error);
      toast({
        title: 'Error',
        description: 'Could not open chat. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleReport = async () => {
    try {
      setIsReporting(true);
      // TODO: Implement report functionality
      toast({
        title: 'Report submitted',
        description: 'Thank you for helping keep our community safe.',
      });
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: 'Error',
        description: 'Could not submit report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsReporting(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: 'Link copied',
        description: 'Profile link has been copied to your clipboard.',
      });
    } catch (error) {
      console.error('Error copying link:', error);
      toast({
        title: 'Error',
        description: 'Could not copy link. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      {/* Removed quick actions card (Message, Share Profile, Report) */}

      {/* Creator Stats */}
      {profile.role === 'creator' && (
        <Card className="p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{profile.stats?.followers?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-500">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{profile.stats?.posts?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-500">Posts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{((profile.stats?.engagement || 0) * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-500">Engagement</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
} 