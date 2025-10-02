import { useEffect } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

interface ImageViewerProps {
  imageUrl: string;
  alt: string;
  onClose: () => void;
}

export function ImageViewer({ imageUrl, alt, onClose }: ImageViewerProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors z-10"
        >
          <X className="w-6 h-6 text-white" />
        </button>
        
        <div className="relative w-full h-full max-w-7xl max-h-[90vh]">
          <Image
            src={imageUrl}
            alt={alt}
            fill
            className="object-contain"
            sizes="100vw"
            priority
            unoptimized={imageUrl.includes('firebasestorage.googleapis.com')}
          />
        </div>
      </div>
    </div>
  );
} 