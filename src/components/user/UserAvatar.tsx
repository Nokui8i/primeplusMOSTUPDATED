import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEffect, useState } from 'react';
import { messagesService } from '@/lib/services/messages';
import { UserPresence } from '@/lib/types/messages';
import { formatDistanceToNow } from 'date-fns';

interface UserAvatarProps {
  userId: string;
  photoURL?: string;
  displayName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showOnlineStatus?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-28 w-28',
};

function formatShortDistance(date: Date) {
  const str = formatDistanceToNow(date, { addSuffix: true });
  return str
    .replace('minutes ago', 'min ago')
    .replace('minute ago', 'min ago')
    .replace('seconds ago', 'sec ago')
    .replace('second ago', 'sec ago');
}

export function UserAvatar({ userId, photoURL, displayName, size = 'md', showOnlineStatus = false }: UserAvatarProps) {
  const [presence, setPresence] = useState<UserPresence | null>(null);

  useEffect(() => {
    if (showOnlineStatus) {
      const unsubscribe = messagesService.subscribeToUserPresence(userId, (presenceData) => {
        setPresence(presenceData);
      });
      return () => unsubscribe();
    }
  }, [userId, showOnlineStatus]);

  // Safe fallback for displayName
  const safeDisplayName = displayName || 'User';
  const fallbackText = safeDisplayName[0]?.toUpperCase() || '?';

  return (
    <div className="relative flex flex-col items-center">
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={photoURL} alt={safeDisplayName} />
        <AvatarFallback>{fallbackText}</AvatarFallback>
      </Avatar>
      {showOnlineStatus && presence && (
        <span 
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
            presence.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      )}
      {showOnlineStatus && presence && presence.status === 'offline' && presence.lastSeen && typeof presence.lastSeen.toDate === 'function' && (
        <span className="mt-2 text-xs text-gray-500">
          {formatShortDistance(presence.lastSeen.toDate())}
        </span>
      )}
    </div>
  );
} 