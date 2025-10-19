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
      style={{
        border: 'none',
        color: '#fff',
        backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
        backgroundColor: 'transparent',
        borderRadius: '20px',
        backgroundSize: '100% auto',
        fontFamily: 'inherit',
        fontSize: '11px',
        padding: '0.3em 0.6em',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        cursor: 'pointer',
        outline: 'none',
        transition: 'all 0.3s ease-in-out',
        boxShadow: 'none',
        margin: '0',
        width: 'auto',
        height: 'auto',
        minWidth: 'auto',
        minHeight: 'auto',
        maxWidth: 'none',
        maxHeight: 'none',
        textDecoration: 'none',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 'normal',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        appearance: 'none',
        backgroundOrigin: 'padding-box',
        backgroundClip: 'padding-box',
        position: 'relative'
      }}
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