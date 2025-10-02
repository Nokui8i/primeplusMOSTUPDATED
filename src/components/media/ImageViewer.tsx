import React, { useRef, useState } from 'react';
import FullScreenButton from '../common/FullScreenButton';

interface ImageViewerProps {
  src: string;
  alt?: string;
  className?: string;
  onError?: (error: Error) => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  src,
  alt = '',
  className = '',
  onError
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
    setIsZoomed(true);
  };

  const handleZoomOut = () => {
    const newScale = Math.max(scale - 0.25, 1);
    setScale(newScale);
    if (newScale === 1) {
      setIsZoomed(false);
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleReset = () => {
    setScale(1);
    setIsZoomed(false);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && scale > 1) {
      e.preventDefault();
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    onError?.(new Error('Failed to load image'));
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full ${className} ${isFullscreen ? 'h-screen' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className={`
          relative w-full overflow-hidden bg-black
          ${isFullscreen ? 'h-screen' : 'min-h-[200px] max-h-[80vh]'}
        `}
      >
        <img
          src={src}
          alt={alt}
          className={`
            w-full h-full object-contain transition-transform duration-300
            ${isZoomed ? 'cursor-move' : 'cursor-zoom-in'}
          `}
          style={{ 
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            touchAction: 'none'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onError={handleImageError}
          draggable={false}
        />

        {/* Image Controls */}
        <div className="absolute top-4 left-4 flex gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors shadow-lg backdrop-blur-sm bg-opacity-80"
            aria-label="Zoom in"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors shadow-lg backdrop-blur-sm bg-opacity-80"
            aria-label="Zoom out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={handleReset}
            className="p-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors shadow-lg backdrop-blur-sm bg-opacity-80"
            aria-label="Reset zoom"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Full Screen Button */}
        <FullScreenButton
          targetRef={containerRef}
          position="bottom-right"
          onFullScreenChange={setIsFullscreen}
          className="shadow-lg backdrop-blur-sm bg-opacity-80"
        />

        {/* Zoom Level Indicator */}
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm shadow-lg backdrop-blur-sm">
          {Math.round(scale * 100)}%
        </div>

        {/* Instructions */}
        {!isZoomed && (
          <div className="absolute bottom-16 left-0 right-0 text-center text-white text-sm opacity-75 pointer-events-none">
            Use zoom controls or click full screen for better view
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageViewer; 