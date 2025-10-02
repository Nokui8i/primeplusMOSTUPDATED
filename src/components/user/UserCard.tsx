'use client';

import Image from 'next/image';
import type { UserProfile } from '@/lib/types/user';
import type { CreatorProfile } from '@/types/user';
import { Badge } from '@/components/ui/badge';
import { FiTwitter, FiInstagram, FiYoutube } from 'react-icons/fi';

interface UserCardProps {
  user: UserProfile | CreatorProfile;
}

export function UserCard({ user }: UserCardProps) {
  // Helper to safely get stats
  const posts = 'stats' in user && user.stats?.posts ? user.stats.posts : 0;
  const followers = 'stats' in user && user.stats?.followers ? user.stats.followers : 0;
  const following = 'stats' in user && user.stats?.following ? user.stats.following : 0;
  // Helper to safely check for youtube
  let youtubeUrl: string | undefined = undefined;
  if (user.socialLinks && 'youtube' in user.socialLinks && typeof user.socialLinks.youtube === 'string') {
    youtubeUrl = user.socialLinks.youtube;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 pt-0 space-y-4">
      {/* Cover Photo Banner */}
      <div className="relative h-16 w-full rounded-t-lg overflow-hidden mb-[-2.5rem]">
        {user.coverPhotoUrl ? (
          <Image
            src={user.coverPhotoUrl}
            alt="Cover photo"
            fill
            sizes="(max-width: 768px) 100vw, 100vw"
            className="object-cover w-full h-full"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gray-200" />
        )}
      </div>
      <div className="flex items-start space-x-4 mt-[-2.5rem]">
        <div className="relative h-16 w-16 z-10">
          <Image
            src={user.photoURL || '/default-avatar.png'}
            alt={user.displayName || user.username}
            fill
            sizes="(max-width: 768px) 64px, 64px"
            priority
            className="rounded-full object-cover border-4 border-white shadow"
          />
          {user.isVerified && (
            <Badge className="absolute bottom-0 right-0 bg-brand-pink-main">
              Verified
            </Badge>
          )}
        </div>
        <div className="flex-1 space-y-1">
          <div>
            <h3 className="font-semibold text-black">{user.displayName || user.username}</h3>
            <p className="text-sm text-black">@{user.username}</p>
          </div>
          {user.bio && (
            <p className="text-sm text-black line-clamp-2">{user.bio}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center space-x-4">
          <div className="text-center">
            <div className="text-sm font-semibold text-black">{posts}</div>
            <div className="text-xs text-black">Posts</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-black">{followers}</div>
            <div className="text-xs text-black">Followers</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-black">{following}</div>
            <div className="text-xs text-black">Following</div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {user.socialLinks?.twitter && (
            <a
              href={`https://twitter.com/${user.socialLinks.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:text-brand-pink-main"
            >
              <FiTwitter className="h-4 w-4" />
            </a>
          )}
          {user.socialLinks?.instagram && (
            <a
              href={`https://instagram.com/${user.socialLinks.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:text-brand-pink-main"
            >
              <FiInstagram className="h-4 w-4" />
            </a>
          )}
          {youtubeUrl && (
            <a
              href={`https://youtube.com/${youtubeUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:text-brand-pink-main"
            >
              <FiYoutube className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
} 