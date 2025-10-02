import { useFollowUser } from '@/lib/follow';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, UserMinus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface FollowButtonProps {
  userId: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function FollowButton({ userId, variant = 'default', size = 'default', className }: FollowButtonProps) {
  const { isFollowing, isLoading, toggleFollow } = useFollowUser(userId);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = async () => {
    await toggleFollow();
    if (!isFollowing) {
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 2000);
    }
  };

  return (
    <Button
      variant={isFollowing ? 'secondary' : variant}
      size={size}
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        'relative transition-all duration-200',
        isFollowing && 'hover:bg-red-50 hover:text-red-600 hover:border-red-200',
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : showConfirm ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Following
        </>
      ) : (
        <>
          {isFollowing ? (
            <>
              <UserMinus className="h-4 w-4 mr-2" />
              <span className="group-hover:hidden">Following</span>
              <span className="hidden group-hover:inline">Unfollow</span>
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-2" />
              Follow
            </>
          )}
        </>
      )}
    </Button>
  );
} 