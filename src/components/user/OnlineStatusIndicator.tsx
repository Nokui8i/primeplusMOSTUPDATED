import { useEffect, useState } from 'react';
import { messagesService } from '@/lib/services/messages';
import { UserPresence } from '@/lib/types/messages';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface OnlineStatusIndicatorProps {
  userId: string;
  showStatus?: boolean;
}

export function OnlineStatusIndicator({ userId, showStatus = true }: OnlineStatusIndicatorProps) {
  const [presence, setPresence] = useState<UserPresence | null>(null);
  const [userPrivacy, setUserPrivacy] = useState<{ showActivityStatus?: boolean } | null>(null);

  useEffect(() => {
    const loadUserPrivacy = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserPrivacy(userData.privacy || {});
        }
      } catch (error) {
        console.error('Error loading user privacy settings:', error);
      }
    };

    loadUserPrivacy();
  }, [userId]);

  useEffect(() => {
    if (showStatus && userPrivacy?.showActivityStatus !== false) {
      const unsubscribe = messagesService.subscribeToUserPresence(userId, (presenceData) => {
        setPresence(presenceData);
      });
      return () => unsubscribe();
    }
  }, [userId, showStatus, userPrivacy]);

  if (!showStatus || userPrivacy?.showActivityStatus === false || !presence) return null;

  return (
    <span 
      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
        presence.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
      }`}
    />
  );
} 