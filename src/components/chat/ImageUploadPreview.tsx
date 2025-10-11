import React, { useState, useCallback, useEffect } from 'react';
import { X, Loader2, Upload, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { useAuth } from '@/hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ImageUploadPreviewProps {
  onUpload: (files: { file: File, locked: boolean, price?: number }[]) => Promise<void>;
  onCancel: () => void;
}

interface PreviewImage {
  file: File;
  preview: string;
  progress: number;
  locked: boolean;
  price?: number;
}

export function ImageUploadPreview({ onUpload, onCancel }: ImageUploadPreviewProps) {
  const { user } = useAuth();
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedImage, setSelectedImage] = useState<PreviewImage | null>(null);
  const [isVerifiedCreator, setIsVerifiedCreator] = useState(false);

  // Check if user is a verified creator
  useEffect(() => {
    const checkVerification = async () => {
      if (!user?.uid) {
        setIsVerifiedCreator(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          setIsVerifiedCreator(false);
          return;
        }

        const userData = userDoc.data();
        const isCreatorRole = userData.role === 'creator' || userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner';
        
        if (isCreatorRole) {
          // Admin, superadmin, and owner roles are automatically verified
          if (userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner') {
            setIsVerifiedCreator(true);
          } else {
            // For regular creators, check BOTH old method (isVerified field) and new method (verificationData collection)
            let verified = false;
            
            if (userData.isVerified === true) {
              verified = true;
            } else {
              const verificationDoc = await getDoc(doc(db, 'verificationData', user.uid));
              if (verificationDoc.exists()) {
                const verificationData = verificationDoc.data();
                verified = verificationData.status === 'approved';
              }
            }
            
            setIsVerifiedCreator(verified);
          }
        } else {
          setIsVerifiedCreator(false);
        }
      } catch (error) {
        console.error('Error checking verification:', error);
        setIsVerifiedCreator(false);
      }
    };

    checkVerification();
  }, [user?.uid]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024 * 1024) { // 10GB limit
        toast.error(`${file.name} is too large (max 10GB)`);
        return false;
      }
      return true;
    });

    // Create previews
    const newPreviews = await Promise.all(
      validFiles.map(async (file) => ({
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        locked: false // default to free
      }))
    );

    setPreviewImages(prev => [...prev, ...newPreviews]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        return false;
      }
      // MOV files will be automatically converted, so we allow them
      // No need to block MOV files anymore
      if (file.size > 10 * 1024 * 1024 * 1024) { // 10GB limit
        toast.error(`${file.name} is too large (max 10GB)`);
        return false;
      }
      return true;
    });

    // Create previews
    const newPreviews = await Promise.all(
      validFiles.map(async (file) => ({
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        locked: false // default to free
      }))
    );

    setPreviewImages(prev => [...prev, ...newPreviews]);
  }, []);

  const removeImage = useCallback((index: number) => {
    setPreviewImages(prev => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index].preview);
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  }, []);

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 5,
      maxWidthOrHeight: 1920,
      useWebWorker: true
    };
    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error('Error compressing image:', error);
      return file; // Return original if compression fails
    }
  };

  const handleLockToggle = (index: number, locked: boolean) => {
    setPreviewImages(prev => {
      const newPreviews = [...prev];
      newPreviews[index] = { ...newPreviews[index], locked };
      return newPreviews;
    });
  };

  const handleUpload = async () => {
    if (previewImages.length === 0) return;

    setIsCompressing(true);
    try {
      // Compress all images
      const compressedFiles = await Promise.all(
        previewImages.map(async (preview) => {
          const compressed = await compressImage(preview.file);
          return { file: compressed, locked: preview.locked, price: preview.price };
        })
      );

      // Update progress for each file
      const updateProgress = (index: number, progress: number) => {
        setPreviewImages(prev => {
          const newPreviews = [...prev];
          newPreviews[index] = { ...newPreviews[index], progress };
          return newPreviews;
        });
      };

      // Upload files
      await onUpload(compressedFiles);
      
      // Clean up previews
      previewImages.forEach(preview => URL.revokeObjectURL(preview.preview));
      setPreviewImages([]);
      onCancel();
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleImageClick = (image: PreviewImage) => {
    setSelectedImage(image);
  };

  const handleClosePreview = () => {
    setSelectedImage(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Upload Images</h3>
          <button 
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Upload Area - Only show when no images selected */}
        {previewImages.length === 0 && (
          <div className="mb-6">
            <label 
              className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <div className="text-sm text-gray-600 font-medium">
                  {isDragging ? 'Drop images here' : 'Click or drag images here'}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Max 10 images, 10GB each
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Image Previews - Only show when images are selected */}
        {previewImages.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-col items-center gap-4">
              {previewImages.map((preview, index) => (
                <div key={index} className="w-64">
                  {/* Image Container */}
                  <div className="relative w-64 h-64 mb-3">
                    <div 
                      className="w-full h-full cursor-pointer"
                      onClick={() => handleImageClick(preview)}
                    >
                      <img
                        src={preview.preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  </div>
                  
                  {/* Action Buttons - Outside and below image */}
                  <div className="flex justify-center gap-3 mb-3">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeImage(index)}
                      className="h-8 px-3"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleImageClick(preview)}
                      className="h-8 px-3"
                    >
                      <ZoomIn className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                  
                  {/* Progress Bar - outside image */}
                  {preview.progress > 0 && preview.progress < 100 && (
                    <div className="w-full h-2 bg-gray-200 rounded-lg mb-3">
                      <div
                        className="h-full bg-blue-500 rounded-lg transition-all duration-300"
                        style={{ width: `${preview.progress}%` }}
                      />
                    </div>
                  )}
                  
                  {/* Lock toggle - Only show for verified creators */}
                  {isVerifiedCreator && (
                    <div className="setting-row">
                      <div className="setting-info">
                        <div className="setting-label">Free / Paid</div>
                        <div className="setting-description">
                          {!preview.locked ? 'Free message' : 'Paid message'}
                        </div>
                      </div>
                      <div className="setting-control flex items-center gap-3">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={preview.locked}
                            onChange={() => handleLockToggle(index, !preview.locked)}
                            className="checkbox"
                          />
                          <span className="slider"></span>
                        </label>
                        
                        {/* Price input - only show when paid is selected */}
                        {preview.locked && (
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs font-medium text-gray-600">
                              Price ($)
                            </label>
                            <input
                              type="number"
                              min="0.99"
                              step="0.01"
                              value={preview.price || '0.99'}
                            onChange={(e) => {
                              const newPrice = parseFloat(e.target.value) || 0.99;
                              const updatedPreviews = [...previewImages];
                              updatedPreviews[index] = { ...preview, price: newPrice };
                              setPreviewImages(updatedPreviews);
                            }}
                            className="w-16 px-1.5 py-0.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent"
                            placeholder="0.99"
                          />
                        </div>
                      )}
                    </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center space-x-8">
          <button
            type="button"
            onClick={onCancel}
            disabled={isCompressing}
            className="profile-btn"
            style={{
              border: 'none',
              color: '#fff',
              backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
              backgroundColor: 'transparent',
              borderRadius: '20px',
              backgroundSize: '100% auto',
              fontFamily: 'inherit',
              fontSize: '14px',
              padding: '0.7em 1.5em',
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
              flexShrink: '0',
              textDecoration: 'none',
              fontWeight: 'normal',
              textTransform: 'none',
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
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={previewImages.length === 0 || isCompressing}
            className="profile-btn"
            style={{
              border: 'none',
              color: '#fff',
              backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
              backgroundColor: 'transparent',
              borderRadius: '20px',
              backgroundSize: '100% auto',
              fontFamily: 'inherit',
              fontSize: '14px',
              padding: '0.7em 1.5em',
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
              flexShrink: '0',
              textDecoration: 'none',
              fontWeight: 'normal',
              textTransform: 'none',
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
            {isCompressing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Compressing...
              </>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>

      {/* Full-size Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center"
          onClick={handleClosePreview}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={selectedImage.preview}
              alt="Full size preview"
              className="max-w-full max-h-[90vh] object-contain"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white"
              onClick={handleClosePreview}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 