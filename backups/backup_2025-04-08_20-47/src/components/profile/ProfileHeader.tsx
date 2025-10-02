'use client';

import { useState } from 'react';
import Image from 'next/image';
import { UserProfile } from '@/lib/types/user';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FiEdit2, FiMapPin, FiLink, FiTwitter, FiInstagram, FiYoutube } from 'react-icons/fi';
import { useToast } from '@/hooks/use-toast';

interface ProfileHeaderProps {
  profile: UserProfile;
  isOwnProfile: boolean;
}

export function ProfileHeader({ profile, isOwnProfile }: ProfileHeaderProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const { toast } = useToast();

  const handleFollow = async () => {
    try {
      // TODO: Implement follow functionality
      setIsFollowing(!isFollowing);
      toast({
        title: isFollowing ? 'Unfollowed' : 'Following',
        description: isFollowing ? 
          `You have unfollowed ${profile.displayName || profile.username}` :
          `You are now following ${profile.displayName || profile.username}`,
      });
    } catch (error) {
      console.error('Error following user:', error);
      toast({
        title: 'Error',
        description: 'Could not update follow status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <div className="relative h-24 w-24">
            <Image
              src={profile.photoURL || '/default-avatar.png'}
              alt={profile.displayName || profile.username}
              fill
              className="rounded-full object-cover"
            />
            {profile.isVerified && (
              <Badge className="absolute bottom-0 right-0 bg-brand-pink-main">
                Verified
              </Badge>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold">
                {profile.displayName || profile.username}
              </h1>
              <span className="text-gray-500">@{profile.username}</span>
            </div>
            {profile.bio && (
              <p className="text-gray-600 max-w-2xl">{profile.bio}</p>
            )}
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              {profile.location && (
                <div className="flex items-center space-x-1">
                  <FiMapPin className="h-4 w-4" />
                  <span>{profile.location}</span>
                </div>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 hover:text-brand-pink-main"
                >
                  <FiLink className="h-4 w-4" />
                  <span>Website</span>
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isOwnProfile ? (
            <Button variant="outline" className="flex items-center space-x-2">
              <FiEdit2 className="h-4 w-4" />
              <span>Edit Profile</span>
            </Button>
          ) : (
            <Button
              variant={isFollowing ? "outline" : "default"}
              onClick={handleFollow}
              className="min-w-[100px]"
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-6">
        <div className="flex items-center space-x-8">
          <div className="text-center">
            <div className="text-2xl font-bold">{profile.stats?.posts || 0}</div>
            <div className="text-sm text-gray-500">Posts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{profile.stats?.followers || 0}</div>
            <div className="text-sm text-gray-500">Followers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{profile.stats?.following || 0}</div>
            <div className="text-sm text-gray-500">Following</div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {profile.socialLinks?.twitter && (
            <a
              href={`https://twitter.com/${profile.socialLinks.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-brand-pink-main"
            >
              <FiTwitter className="h-5 w-5" />
            </a>
          )}
          {profile.socialLinks?.instagram && (
            <a
              href={`https://instagram.com/${profile.socialLinks.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-brand-pink-main"
            >
              <FiInstagram className="h-5 w-5" />
            </a>
          )}
          {profile.socialLinks?.youtube && (
            <a
              href={`https://youtube.com/${profile.socialLinks.youtube}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-brand-pink-main"
            >
              <FiYoutube className="h-5 w-5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
} 