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
    <Button
      size={size}
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        'bg-gradient-to-r from-[#6B3BFF] to-[#2B55FF] text-white hover:from-[#7C5FE6] hover:to-[#3B6BFF] flex flex-col items-center justify-center',
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <span className="leading-tight">Following</span>
      ) : (
        <span className="leading-tight">Follow</span>
      )}
    </Button>
  );
}

export { useFollowStats }; 