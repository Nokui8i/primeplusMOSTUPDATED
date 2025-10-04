import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { Cropper, CropperRef, CropperState } from 'react-advanced-cropper';
import { Upload, X } from 'lucide-react';
import 'react-advanced-cropper/dist/style.css';
import { updateProfile } from 'firebase/auth';
import { ImageViewer } from '@/components/ui/ImageViewer';
import { messagesService } from '@/lib/services/messages';
import { UserPresence } from '@/lib/types/messages';

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
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null);
  const [tempPhotoUrl, setTempPhotoUrl] = useState<string | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showUploadUI, setShowUploadUI] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<CropperRef>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);
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

  // Close menu and upload UI when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (uploadRef.current && !uploadRef.current.contains(event.target as Node)) {
        setShowUploadUI(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Create temporary preview URL
    const preview = URL.createObjectURL(file);
    setTempPhotoUrl(preview);
    setCroppedPreview(null);
    setIsEditing(true);
    setShowMenu(false);
    setShowUploadUI(false);
  };

  const handleEdit = () => {
    if (!currentPhotoUrl) return;
    setTempPhotoUrl(currentPhotoUrl);
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleDelete = async () => {
    if (!user || !currentPhotoUrl) return;

    setIsUploading(true);
    try {
      // Delete from storage (Firebase or AWS S3)
      if (currentPhotoUrl.includes('firebasestorage.googleapis.com')) {
        const imageRef = ref(storage, currentPhotoUrl);
        await deleteObject(imageRef);
      } else if (currentPhotoUrl.includes('cloudfront.net')) {
        // Delete from AWS S3
        const { deleteFromS3, extractS3KeyFromUrl } = await import('@/lib/aws/s3');
        const s3Key = extractS3KeyFromUrl(currentPhotoUrl);
        if (s3Key) {
          await deleteFromS3(s3Key);
        }
      }

      // Update user profile
      await updateProfile(user, { photoURL: '' });
      await updateDoc(doc(db, 'users', user.uid), { photoURL: '' });

      setCurrentPhotoUrl(null);
      onPhotoUpdate?.('');
      setShowMenu(false);
    } catch (error) {
      console.error('Error deleting photo:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const updateCroppedPreview = () => {
    if (!cropperRef.current) return;
    
    const canvas = cropperRef.current.getCanvas();
    if (canvas) {
      const preview = canvas.toDataURL('image/jpeg', 0.95);
      setCroppedPreview(preview);
    }
  };

  const handleSave = async () => {
    if (!user || !cropperRef.current) return;

    setIsUploading(true);
    setImageError(false);
    try {
      const canvas = cropperRef.current.getCanvas();
      if (!canvas) throw new Error('Failed to get canvas');

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/jpeg', 0.95);
      });

      // Delete old photo if exists
      if (currentPhotoUrl) {
        try {
          if (currentPhotoUrl.includes('firebasestorage.googleapis.com')) {
            // Delete from Firebase Storage
            const imageRef = ref(storage, currentPhotoUrl);
            await deleteObject(imageRef);
          } else if (currentPhotoUrl.includes('cloudfront.net')) {
            // Delete from AWS S3
            const { deleteFromS3, extractS3KeyFromUrl } = await import('@/lib/aws/s3');
            const s3Key = extractS3KeyFromUrl(currentPhotoUrl);
            if (s3Key) {
              await deleteFromS3(s3Key);
            }
          }
        } catch (deleteError) {
          console.error('Error deleting old photo:', deleteError);
          // Continue with upload even if deletion fails
        }
      }

      // Upload new photo to AWS S3
      const file = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
      const { uploadToS3, generateS3Key } = await import('@/lib/aws/s3');
      const s3Key = generateS3Key(user.uid, `profile-photo-${Date.now()}.jpg`, 'images');
      const photoURL = await uploadToS3(file, s3Key);

      // Update user profile
      await updateProfile(user, { photoURL });
      await updateDoc(doc(db, 'users', user.uid), { photoURL });

      setCurrentPhotoUrl(photoURL);
      onPhotoUpdate?.(photoURL);
      setIsEditing(false);
      setTempPhotoUrl(null);
      setCroppedPreview(null);
    } catch (error) {
      console.error('Error saving photo:', error);
      setImageError(true);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    setTempPhotoUrl(null);
    setCroppedPreview(null);
  };

  // Cleanup temporary URLs when component unmounts
  useEffect(() => {
    return () => {
      if (tempPhotoUrl && tempPhotoUrl !== currentPhotoUrl) {
        URL.revokeObjectURL(tempPhotoUrl);
      }
    };
  }, [tempPhotoUrl, currentPhotoUrl]);

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
        className={`relative rounded-full overflow-hidden ${
          isUploading ? 'opacity-50' : ''
        } shadow-lg cursor-pointer`}
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
        onMouseEnter={() => {
          console.log('🔍 ProfilePhoto: Mouse enter, isOwnProfile:', isOwnProfile);
          isOwnProfile && setShowMenu(true);
        }}
        onMouseLeave={() => {
          console.log('🔍 ProfilePhoto: Mouse leave, isOwnProfile:', isOwnProfile);
          isOwnProfile && setShowMenu(false);
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

        {/* Only show menu if isOwnProfile */}
        {isOwnProfile && showMenu && (
          <div 
            ref={menuRef}
            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-full"
          >
            <div className="flex gap-2">
              {/* Upload/Add Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                title={currentPhotoUrl ? "Replace photo" : "Add photo"}
              >
                <Upload className="w-4 h-4 text-gray-600" />
              </button>
              
              {/* Delete Button - only if photo exists */}
              {currentPhotoUrl && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this profile photo?')) {
                      handleDelete();
                    }
                  }}
                  className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                  title="Delete photo"
                >
                  <X className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Image Viewer Modal */}
      {showImageViewer && currentPhotoUrl && (
        <ImageViewer
          imageUrl={currentPhotoUrl}
          alt="Profile photo"
          onClose={() => setShowImageViewer(false)}
        />
      )}

      {/* Editing Modal */}
      {isEditing && tempPhotoUrl && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div 
              ref={uploadRef}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Edit Profile Photo
                </h3>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="relative w-full h-64 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                    <Cropper
                      src={tempPhotoUrl}
                      ref={cropperRef}
                      aspectRatio={(state: CropperState) => 1}
                      onChange={updateCroppedPreview}
                    />
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative w-40 h-40 rounded-full overflow-hidden mb-4 bg-gray-800">
                      {croppedPreview ? (
                        <Image
                          src={croppedPreview}
                          alt="Preview"
                          fill
                          className="object-cover"
                          sizes="160px"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <span className="text-gray-400">Preview</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-4">
                      This is how your profile photo will look
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleClose}
                        className="px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isUploading}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                      >
                        {isUploading ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
