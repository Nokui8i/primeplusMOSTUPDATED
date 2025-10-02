import React, { useState, useCallback } from 'react';
import { X, Loader2, Upload, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

interface ImageUploadPreviewProps {
  onUpload: (files: { file: File, locked: boolean }[]) => Promise<void>;
  onCancel: () => void;
}

interface PreviewImage {
  file: File;
  preview: string;
  progress: number;
  locked: boolean;
}

export function ImageUploadPreview({ onUpload, onCancel }: ImageUploadPreviewProps) {
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedImage, setSelectedImage] = useState<PreviewImage | null>(null);

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
          return { file: compressed, locked: preview.locked };
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
      <div className="bg-white rounded-xl p-4 w-full max-w-2xl mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Upload Images</h3>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Image Grid */}
        <div 
          className={`grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 ${
            previewImages.length === 0 ? 'min-h-[200px]' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {previewImages.map((preview, index) => (
            <div key={index} className="relative aspect-square group">
              <div 
                className="w-full h-full cursor-pointer"
                onClick={() => handleImageClick(preview)}
              >
                <img
                  src={preview.preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                {/* Lock toggle */}
                <div className="absolute bottom-2 left-2 bg-white/80 rounded px-2 py-1 flex items-center gap-2 shadow">
                  <label className="text-xs font-medium">
                    <input
                      type="radio"
                      checked={!preview.locked}
                      onChange={() => handleLockToggle(index, false)}
                      className="accent-blue-500 mr-1"
                    />
                    Free
                  </label>
                  <label className="text-xs font-medium">
                    <input
                      type="radio"
                      checked={preview.locked}
                      onChange={() => handleLockToggle(index, true)}
                      className="accent-fuchsia-500 mr-1"
                    />
                    Paid
                  </label>
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(index);
                      }}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleImageClick(preview);
                      }}
                      className="h-8 w-8"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              {preview.progress > 0 && preview.progress < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-lg">
                  <div
                    className="h-full bg-blue-500 rounded-b-lg transition-all duration-300"
                    style={{ width: `${preview.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
          {previewImages.length < 10 && (
            <label 
              className={`aspect-square border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-blue-500'
              }`}
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
                <div className="text-sm text-gray-500">
                  {isDragging ? 'Drop images here' : 'Click or drag images here'}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Max 10 images, 10GB each
                </div>
              </div>
            </label>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isCompressing}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={previewImages.length === 0 || isCompressing}
          >
            {isCompressing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Compressing...
              </>
            ) : (
              `Upload ${previewImages.length} Image${previewImages.length === 1 ? '' : 's'}`
            )}
          </Button>
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