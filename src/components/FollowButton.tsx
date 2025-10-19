import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFollowUser, useFollowStats } from '@/lib/follow';

interface FollowButtonProps {
  userId: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function FollowButton({
  userId,
  size = 'default',
  className
}: FollowButtonProps) {
  const { isFollowing, isLoading, toggleFollow } = useFollowUser(userId);


  const handleClick = async () => {
    if (isLoading) return;
    await toggleFollow();
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        'profile-btn follow',
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <span>FOLLOWING</span>
      ) : (
        <span>FOLLOW</span>
      )}
    </button>
  );
}

export { useFollowStats }; 