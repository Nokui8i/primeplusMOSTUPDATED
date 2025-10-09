import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { X } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { ImageViewer } from '@/components/ui/ImageViewer';
import { messagesService } from '@/lib/services/messages';
import { UserPresence } from '@/lib/types/messages';
import { PhotoEditor } from '@/components/settings/PhotoEditor';
import { toast } from 'sonner';

interface ProfilePhotoProps {
  photoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onPhotoUpdate?: (url: string) => void;
  isOwnProfile?: boolean;
  userId?: string; // Add userId to check the correct user's status
}

const sizeMap = {
  sm: 32,
  md: 64,
  lg: 120,
};

export function ProfilePhoto({ photoUrl, size = 'md', className = '', onPhotoUpdate, isOwnProfile, userId }: ProfilePhotoProps) {
  console.log('🔍 ProfilePhoto: Component rendered with isOwnProfile:', isOwnProfile);
  const [imageError, setImageError] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const { user } = useAuth();
  const [presence, setPresence] = useState<UserPresence | null>(null);

  useEffect(() => {
    if (photoUrl) {
      setCurrentPhotoUrl(photoUrl);
    }
  }, [photoUrl]);

  // Subscribe to user presence
  useEffect(() => {
    const targetUserId = userId || user?.uid;
    if (!targetUserId) return;

    console.log('🔍 ProfilePhoto: Subscribing to presence for userId:', targetUserId);

    const unsubscribe = messagesService.subscribeToUserPresence(targetUserId, (presenceData) => {
      console.log('🔍 ProfilePhoto: Received presence data:', JSON.stringify(presenceData, null, 2));
      setPresence(presenceData);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userId, user?.uid]);


  return (
    <div 
      className={`relative ${className}`} 
      style={{ 
        marginTop: `-${sizeMap[size] / 2}px`, 
        marginLeft: '1rem',
        padding: '8px' // Add padding for the indicator
      }}
    >
      <div
        className={`relative rounded-full overflow-hidden shadow-lg cursor-pointer`}
        style={{ 
          width: sizeMap[size], 
          height: sizeMap[size],
          padding: '4px', // Add padding around the image circle
          border: '4px solid', // Dynamic border color based on online status
          borderColor: (presence && presence.status === 'online') ? '#22C55E' : '#9CA3AF', // Brighter green if online, gray if offline or no presence
          boxShadow: (presence && presence.status === 'online') 
            ? '0 0 20px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.3)' 
            : '0 0 10px rgba(156, 163, 175, 0.3)', // Glowing effect for online, subtle for offline
          
          backgroundColor: 'rgba(255, 0, 0, 0.1)'
        }}
        onClick={() => currentPhotoUrl && setShowImageViewer(true)}
      >
        {currentPhotoUrl && !imageError ? (
          <Image
            src={currentPhotoUrl}
            alt="Profile photo"
            fill
            priority
            className="object-cover"
            sizes={`${sizeMap[size]}px`}
            onError={() => setImageError(true)}
            unoptimized={currentPhotoUrl.includes('firebasestorage.googleapis.com')}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-xl">
              {user?.displayName?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
        )}

      </div>

      {/* Image Viewer Modal */}
      {showImageViewer && currentPhotoUrl && (
        <ImageViewer
          imageUrl={currentPhotoUrl}
          alt="Profile photo"
          onClose={() => setShowImageViewer(false)}
        />
      )}
    </div>
  );
}
