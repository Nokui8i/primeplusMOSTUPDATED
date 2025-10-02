import Link from 'next/link';
import { useFollowStats } from '@/lib/follow';
import { FollowButton } from '@/components/FollowButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface CreatorCardProps {
  userId: string;
  username: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  stats?: {
    followers: number;
    posts: number;
    engagement: number;
  };
}

export function CreatorCard({ userId, username, displayName, photoURL, bio, stats }: CreatorCardProps) {
  const { stats: followStats, isLoading } = useFollowStats(userId);

  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <Link href={`/${username}`} className="hover:opacity-80 transition-opacity">
          <Avatar className="h-12 w-12">
            <AvatarImage src={photoURL} alt={displayName} />
            <AvatarFallback>{displayName[0]}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex flex-col">
          <Link href={`/${username}`} className="hover:underline">
            <h3 className="text-lg font-semibold">{displayName}</h3>
          </Link>
          <div className="flex gap-4 text-sm text-gray-600">
            <span>{stats?.followers || followStats.followersCount} followers</span>
            <span>{stats?.posts || 0} posts</span>
          </div>
        </div>
        <FollowButton userId={userId} variant="outline" className="ml-auto" />
      </CardHeader>
      {bio && (
        <CardContent>
          <p className="text-sm text-gray-600">{bio}</p>
        </CardContent>
      )}
    </Card>
  );
} 