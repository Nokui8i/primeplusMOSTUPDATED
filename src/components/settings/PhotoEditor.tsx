'use client';

import { useState, useRef } from 'react';
import { Cropper, CropperRef, CropperState } from 'react-advanced-cropper';
import 'react-advanced-cropper/dist/style.css';
import { Loader2, X } from 'lucide-react';
import Image from 'next/image';

interface PhotoEditorProps {
  imageUrl: string;
  onSave: (croppedImageBlob: Blob) => Promise<void>;
  onCancel: () => void;
}

export function PhotoEditor({ imageUrl, onSave, onCancel }: PhotoEditorProps) {
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const cropperRef = useRef<CropperRef>(null);
  const lastUpdateTimeRef = useRef(0);
  const updateThrottleMs = 33; // Update preview every 33ms (30fps)
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
          // Create a smaller canvas for faster preview
          const previewCanvas = document.createElement('canvas');
          const maxSize = 256; // Small preview for speed (profile photos are circular and small)
          const scale = Math.min(1, maxSize / Math.max(canvas.width, canvas.height));
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
    if (!cropperRef.current) return;

    setSaving(true);
    try {
      const canvas = cropperRef.current.getCanvas();
      if (!canvas) throw new Error('Failed to get canvas');

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/jpeg', 0.95);
      });

      await onSave(blob);
    } catch (error) {
      console.error('Error saving cropped image:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div 
        className="rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 0 0 rgba(255, 255, 255, 0.5)',
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Edit Profile Photo
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="relative w-full h-64 border border-gray-300 rounded-lg overflow-hidden">
            <Cropper
              src={imageUrl}
              ref={cropperRef}
              aspectRatio={(state: CropperState) => 1}
              onChange={handleCropChange}
              onInteractionEnd={handleCropComplete}
            />
          </div>
          
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-32 h-32 rounded-full overflow-hidden mb-3 bg-gray-800">
              {croppedPreview ? (
                <Image
                  src={croppedPreview}
                  alt="Preview"
                  fill
                  className="object-cover"
                  sizes="128px"
                />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <span className="text-gray-400 text-xs">Preview</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-4">
              This is how your profile photo will look
            </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={saving}
                  style={{
                    border: 'none',
                    color: '#fff',
                    backgroundImage: 'linear-gradient(30deg, #6b7280, #9ca3af)',
                    backgroundColor: 'transparent',
                    borderRadius: '20px',
                    backgroundSize: '100% auto',
                    fontFamily: 'inherit',
                    fontSize: '11px',
                    padding: '0.3em 0.6em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    outline: 'none',
                    transition: 'all 0.3s ease-in-out',
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  <span>CANCEL</span>
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
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
                    cursor: saving ? 'not-allowed' : 'pointer',
                    outline: 'none',
                    transition: 'all 0.3s ease-in-out',
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2 className="inline h-3 w-3 animate-spin" />
                      <span>SAVING...</span>
                    </>
                  ) : (
                    <span>SAVE</span>
                  )}
                </button>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}

