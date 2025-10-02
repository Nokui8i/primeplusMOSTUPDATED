import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEffect, useState } from 'react';
import { messagesService } from '@/lib/services/messages';
import { UserPresence } from '@/lib/types/messages';

interface UserAvatarProps {
  userId: string;
  photoURL?: string;
  displayName: string;
  size?: 'sm' | 'md' | 'lg';
  showOnlineStatus?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12'
};

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

  return (
    <div className="relative">
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={photoURL} alt={displayName} />
        <AvatarFallback>{displayName[0]}</AvatarFallback>
      </Avatar>
      {showOnlineStatus && presence && (
        <span 
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
            presence.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      )}
    </div>
  );
} 