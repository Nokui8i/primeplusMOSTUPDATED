import { useEffect } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { PinchZoomPan } from './PinchZoomPan';

interface ImageViewerProps {
  imageUrl: string;
  alt: string;
  onClose: () => void;
  isCoverPhoto?: boolean;
}

export function ImageViewer({ imageUrl, alt, onClose, isCoverPhoto = false }: ImageViewerProps) {
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

  // Prevent body scroll when viewer is open - More aggressive approach
  useEffect(() => {
    // Store scroll position before locking
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    // Store original styles
    const originalBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      width: document.body.style.width,
      height: document.body.style.height,
      top: document.body.style.top,
      left: document.body.style.left,
      touchAction: document.body.style.touchAction,
      overscrollBehavior: document.body.style.overscrollBehavior,
    };
    
    const originalHtmlStyle = {
      overflow: document.documentElement.style.overflow,
      position: document.documentElement.style.position,
      width: document.documentElement.style.width,
      height: document.documentElement.style.height,
      touchAction: document.documentElement.style.touchAction,
      overscrollBehavior: document.documentElement.style.overscrollBehavior,
    };
    
    // Find and disable main content scrolling
    const mainContent = document.querySelector('main.overflow-y-auto, main');
    const originalMainStyle = mainContent ? {
      overflow: (mainContent as HTMLElement).style.overflow,
      position: (mainContent as HTMLElement).style.position,
      touchAction: (mainContent as HTMLElement).style.touchAction,
    } : null;
    
    // Lock body scroll while preserving scroll position - Use same approach as MediaContent
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = `-${scrollX}px`;
    // Don't block touch-action on body - let images handle it
    document.body.style.overscrollBehavior = 'none';
    
    // Lock html scroll
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100vh';
    document.documentElement.style.position = 'fixed';
    document.documentElement.style.width = '100%';
    document.documentElement.style.top = `-${scrollY}px`;
    // Don't block touch-action on html - let images handle it
    document.documentElement.style.overscrollBehavior = 'none';
    
    // Lock main content if exists
    if (mainContent) {
      (mainContent as HTMLElement).style.overflow = 'hidden';
      (mainContent as HTMLElement).style.position = 'fixed';
      // Don't block touch-action on main - let images handle it
    }
    
    // Prevent wheel scrolling - Block ALL wheel events like MediaContent
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    // Don't prevent touchmove - let CSS touch-action handle it
    // This allows pinch-zoom to work naturally on images
    
    // Cleanup function
    return () => {
      // Restore original styles
      document.body.style.overflow = originalBodyStyle.overflow;
      document.body.style.position = originalBodyStyle.position;
      document.body.style.width = originalBodyStyle.width;
      document.body.style.height = originalBodyStyle.height;
      document.body.style.top = originalBodyStyle.top;
      document.body.style.left = originalBodyStyle.left;
      document.body.style.touchAction = originalBodyStyle.touchAction;
      document.body.style.overscrollBehavior = originalBodyStyle.overscrollBehavior;
      
      document.documentElement.style.overflow = originalHtmlStyle.overflow;
      document.documentElement.style.position = originalHtmlStyle.position;
      document.documentElement.style.width = originalHtmlStyle.width;
      document.documentElement.style.height = originalHtmlStyle.height;
      document.documentElement.style.touchAction = originalHtmlStyle.touchAction;
      document.documentElement.style.overscrollBehavior = originalHtmlStyle.overscrollBehavior;
      
      // Restore main content if exists
      if (mainContent && originalMainStyle) {
        (mainContent as HTMLElement).style.overflow = originalMainStyle.overflow;
        (mainContent as HTMLElement).style.position = originalMainStyle.position;
        (mainContent as HTMLElement).style.touchAction = originalMainStyle.touchAction;
      }
      
      // Restore scroll position
      window.scrollTo(scrollX, scrollY);
      
      // Remove event listeners
      document.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-2 sm:p-8"
      data-image-viewer-overlay
      style={{ 
        touchAction: 'pan-y pinch-zoom', 
        overscrollBehavior: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        zIndex: 1000
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      // Don't prevent touchmove - let CSS touch-action handle it
    >
      <div 
        className="relative max-w-4xl w-full max-h-[90vh] sm:max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-300 px-2 sm:px-8"
        data-modal-content
        style={{ touchAction: 'pan-y pinch-zoom' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors z-[1001]"
        >
          <X className="w-4 h-4 text-white" />
        </button>
        
        <div className={`relative w-full h-full ${isCoverPhoto ? 'max-w-[95vw] sm:max-w-4xl' : 'max-w-4xl'} mx-auto`}>
          <PinchZoomPan
            className="w-full h-full"
            minScale={1}
            maxScale={5}
          >
            <div 
              className={`relative w-full ${isCoverPhoto ? 'aspect-[16/9]' : 'aspect-square'} ${isCoverPhoto ? 'max-h-[95vh] sm:max-h-[85vh]' : 'max-h-[85vh]'} max-w-full`}
              data-image-zoomable
              style={{ 
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none'
              }}
            >
          <Image
            src={imageUrl}
            alt={alt}
            fill
            className="object-contain"
            sizes="100vw"
            priority
            unoptimized={imageUrl.includes('firebasestorage.googleapis.com')}
                style={{ 
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
          />
            </div>
          </PinchZoomPan>
        </div>
      </div>
    </div>
  );
} 