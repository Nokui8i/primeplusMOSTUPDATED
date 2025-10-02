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
      {!isOwnProfile && (
        <Card className="p-4 shadow-sm">
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start hover:bg-gray-50 transition-colors"
              onClick={handleMessage}
            >
              <FiMessageSquare className="h-4 w-4 mr-2 text-gray-500" />
              Message
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start hover:bg-gray-50 transition-colors"
              onClick={handleShare}
            >
              <FiShare2 className="h-4 w-4 mr-2 text-gray-500" />
              Share Profile
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              onClick={handleReport}
              disabled={isReporting}
            >
              <FiFlag className="h-4 w-4 mr-2" />
              {isReporting ? 'Submitting...' : 'Report'}
            </Button>
          </div>
        </Card>
      )}

      {/* About */}
      <Card className="p-4 shadow-sm">
        <div className="space-y-4">
          {profile.bio && (
            <div>
              <p className="text-gray-900 leading-relaxed">{profile.bio}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            {profile.location && (
              <div className="flex items-center">
                <span>📍 {profile.location}</span>
              </div>
            )}
            <div className="flex items-center">
              <span>🗓️ Joined {profile.createdAt && (
                typeof profile.createdAt === 'object' && 'toDate' in profile.createdAt
                  ? profile.createdAt.toDate().toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric'
                    })
                  : new Date(profile.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric'
                    })
              )}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Creator Stats */}
      {profile.role === 'creator' && (
        <Card className="p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{profile.stats?.followers?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-500">Subscribers</div>
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