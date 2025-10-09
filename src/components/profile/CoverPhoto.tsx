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
import { ImageViewer } from '@/components/ui/ImageViewer';
import { processImage, IMAGE_QUALITY_SETTINGS } from '@/utils/mediaProcessing';

interface CoverPhotoProps {
  photoUrl?: string;
  className?: string;
  onPhotoUpdate?: (url: string) => void;
  children?: React.ReactNode;
  isOwnProfile?: boolean;
}

export function CoverPhoto({ photoUrl, className = '', onPhotoUpdate, children, isOwnProfile }: CoverPhotoProps) {
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

  useEffect(() => {
    if (photoUrl) {
      setCurrentPhotoUrl(photoUrl);
    }
  }, [photoUrl]);

  // Close menu and upload UI when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
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
        // Delete from Firebase Storage
        const url = new URL(currentPhotoUrl);
        const path = decodeURIComponent(url.pathname.split('/o/')[1]);
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
      } else if (currentPhotoUrl.includes('cloudfront.net')) {
        // Delete from AWS S3
        const { deleteFromS3, extractS3KeyFromUrl } = await import('@/lib/aws/s3');
        try {
          const s3Key = extractS3KeyFromUrl(currentPhotoUrl);
          if (s3Key) {
            await deleteFromS3(s3Key);
          }
        } catch (error) {
          console.error('Error deleting cover photo from S3:', error);
        }
      }

      // Update Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        coverPhotoUrl: null,
        updatedAt: new Date(),
      });

      setCurrentPhotoUrl(null);
      onPhotoUpdate?.('');
      setShowMenu(false);
    } catch (error) {
      console.error('Error deleting cover photo:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const lastUpdateTimeRef = useRef(0);
  const updateThrottleMs = 33; // Update preview every 33ms (30fps) while dragging
  const isUpdatingPreviewRef = useRef(false);
  
  const updateCroppedPreview = () => {
    if (!cropperRef.current || isUpdatingPreviewRef.current) return;
    
    isUpdatingPreviewRef.current = true;
    
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      try {
        if (!cropperRef.current) return;
        
        const canvas = cropperRef.current.getCanvas();
        if (canvas) {
          // Create a much smaller canvas for maximum speed
          const previewCanvas = document.createElement('canvas');
          const maxWidth = 400; // Even smaller for ultra-fast preview
          const scale = Math.min(1, maxWidth / canvas.width);
          previewCanvas.width = canvas.width * scale;
          previewCanvas.height = canvas.height * scale;
          
          const ctx = previewCanvas.getContext('2d', { 
            alpha: false,
            desynchronized: true 
          });
          
          if (ctx) {
            // Faster rendering with lower quality
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'low';
            ctx.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
            const preview = previewCanvas.toDataURL('image/jpeg', 0.5);
            setCroppedPreview(preview);
          }
        }
      } finally {
        isUpdatingPreviewRef.current = false;
      }
    });
  };
  
  const handleCropChange = () => {
    const now = Date.now();
    
    // Throttle updates: only update if enough time has passed
    if (now - lastUpdateTimeRef.current >= updateThrottleMs) {
      lastUpdateTimeRef.current = now;
      updateCroppedPreview();
    }
  };
  
  const handleCropComplete = () => {
    // Always update on completion for final accuracy
    updateCroppedPreview();
  };

  const handleSave = async () => {
    if (!user || !cropperRef.current) return;

    setIsUploading(true);
    setImageError(false);
    try {
      const canvas = cropperRef.current.getCanvas();
      if (!canvas) {
        throw new Error('No canvas available');
      }

      // Convert canvas to blob with high quality settings
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, IMAGE_QUALITY_SETTINGS.high.format, IMAGE_QUALITY_SETTINGS.high.quality);
      });

      // Process the image for optimal quality
      const processedBlob = await processImage(
        new File([blob], 'cover.jpg', { type: IMAGE_QUALITY_SETTINGS.high.format }),
        'high'
      );

      // Delete old cover photo if exists
      if (currentPhotoUrl) {
        try {
          if (currentPhotoUrl.includes('firebasestorage.googleapis.com')) {
            // Delete from Firebase Storage
            const url = new URL(currentPhotoUrl);
            const path = decodeURIComponent(url.pathname.split('/o/')[1]);
            const storageRef = ref(storage, path);
            await deleteObject(storageRef);
          } else if (currentPhotoUrl.includes('cloudfront.net')) {
            // Delete from AWS S3
            const { deleteFromS3, extractS3KeyFromUrl } = await import('@/lib/aws/s3');
            const s3Key = extractS3KeyFromUrl(currentPhotoUrl);
            if (s3Key) {
              await deleteFromS3(s3Key);
            }
          }
        } catch (deleteError) {
          console.error('Error deleting old cover photo:', deleteError);
          // Continue with upload even if deletion fails
        }
      }

      // Upload new cover photo to AWS S3
      const { uploadToS3, generateS3Key } = await import('@/lib/aws/s3');
      const s3Key = generateS3Key(user.uid, `cover-${Date.now()}.webp`, 'images');
      const downloadUrl = await uploadToS3(processedBlob as File, s3Key);

      // Update Firestore
      const userRef = doc(db, 'users', user.uid);
      const updateData = {
        coverPhotoUrl: downloadUrl,
        updatedAt: new Date(),
      };
      await updateDoc(userRef, updateData);

      setCurrentPhotoUrl(downloadUrl);
      onPhotoUpdate?.(downloadUrl);
      setIsEditing(false);
    } catch (error) {
      console.error('Error uploading cover photo:', error);
      setImageError(true);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    setCroppedPreview(null);
    if (tempPhotoUrl && tempPhotoUrl !== currentPhotoUrl) {
      URL.revokeObjectURL(tempPhotoUrl);
      setTempPhotoUrl(null);
    }
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
    <div className={`relative w-full max-w-2xl mx-auto pb-16 ${className}`}>
      <div
        className={`relative w-full overflow-hidden ${className} ${
          isUploading ? 'opacity-50' : ''
        } border border-gray-600/30 dark:border-gray-500/30 shadow-sm cursor-pointer`}
        onMouseEnter={() => isOwnProfile && setShowMenu(true)}
        onMouseLeave={() => isOwnProfile && setShowMenu(false)}
        onClick={() => currentPhotoUrl && setShowImageViewer(true)}
      >
        {currentPhotoUrl && !imageError ? (
          <Image
            src={currentPhotoUrl}
            alt="Cover photo"
            fill
            priority
            className="object-cover"
            sizes="100vw"
            onError={() => setImageError(true)}
            unoptimized={currentPhotoUrl.includes('firebasestorage.googleapis.com')}
          />
        ) : (
          <div className="w-full h-56 bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-xl">No cover photo</span>
          </div>
        )}

        {/* Only show menu if isOwnProfile */}
        {isOwnProfile && showMenu && (
          <div 
            ref={menuRef}
            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          >
            <div className="flex gap-2">
              {/* Upload/Add Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUploadUI(true);
                }}
                className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                title={currentPhotoUrl ? "Replace cover photo" : "Add cover photo"}
              >
                <Upload className="w-4 h-4 text-gray-600" />
              </button>
              
              {/* Delete Button - only if photo exists */}
              {currentPhotoUrl && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this cover photo?')) {
                      handleDelete();
                    }
                  }}
                  disabled={isUploading}
                  className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                  title="Delete cover photo"
                >
                  <X className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Image Viewer */}
      {showImageViewer && currentPhotoUrl && (
        <ImageViewer
          imageUrl={currentPhotoUrl}
          alt="Cover photo"
          onClose={() => setShowImageViewer(false)}
        />
      )}

      {/* Only show file input and modals if isOwnProfile */}
      {isOwnProfile && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Upload UI Modal */}
          {showUploadUI && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
              <div 
                ref={uploadRef}
                className="rounded-lg p-6 w-full max-w-md"
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 0 0 rgba(255, 255, 255, 0.5)',
                }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Upload Cover Photo</h3>
                  <button
                    onClick={() => setShowUploadUI(false)}
                    className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <div
                  className="border-2 border-dashed rounded-lg p-8 transition-all duration-200 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    borderColor: 'rgba(200, 200, 200, 0.5)',
                    background: 'rgba(255, 255, 255, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(200, 200, 200, 0.5)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                  }}
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Upload className="w-8 h-8 text-gray-600" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        JPG, PNG or GIF (max. 10MB)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cropping Modal */}
          {isEditing && tempPhotoUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
              <div 
                className="rounded-xl p-6 w-full max-w-4xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 0 0 rgba(255, 255, 255, 0.5)',
                }}
              >
                <div className="grid grid-cols-2 gap-6">
                  <div className="h-[400px] rounded-lg overflow-hidden" style={{ background: '#f3f4f6' }}>
                    <Cropper
                      src={tempPhotoUrl}
                      className="h-full w-full"
                      ref={cropperRef}
                      aspectRatio={(state: CropperState) => 4/1}
                      onChange={handleCropChange}
                      onInteractionEnd={handleCropComplete}
                      stencilProps={{
                        handlers: true,
                        lines: true,
                        movable: true,
                        resizable: true,
                      }}
                    />
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
                    <div 
                      className="relative w-full h-32 rounded-lg overflow-hidden mb-3"
                      style={{
                        background: 'rgba(255, 255, 255, 0.5)',
                        border: '1px solid rgba(200, 200, 200, 0.3)',
                      }}
                    >
                      {croppedPreview ? (
                        <Image
                          src={croppedPreview}
                          alt="Preview"
                          fill
                          className="object-cover"
                          sizes="100vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-gray-500">Preview</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-6">
                      This is how your cover photo will look
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                        style={{
                          border: 'none',
                          color: '#374151',
                          backgroundImage: 'linear-gradient(30deg, #e5e7eb, #f3f4f6)',
                          fontSize: '13px',
                          fontWeight: '500',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isUploading}
                        style={{
                          border: 'none',
                          color: '#fff',
                          backgroundImage: isUploading ? 'linear-gradient(30deg, #9ca3af, #d1d5db)' : 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                          backgroundColor: 'transparent',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '500',
                          padding: '0.5em 1em',
                          cursor: isUploading ? 'not-allowed' : 'pointer',
                          opacity: isUploading ? 0.6 : 1,
                        }}
                      >
                        {isUploading ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {children}
    </div>
  );
} 