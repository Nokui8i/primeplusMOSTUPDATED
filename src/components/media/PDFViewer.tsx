import React, { useRef, useState } from 'react';
import FullScreenButton from '../common/FullScreenButton';

interface PDFViewerProps {
  src: string;
  className?: string;
  onError?: (error: Error) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  src,
  className = '',
  onError
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleReset = () => {
    setScale(1);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full ${className} ${isFullscreen ? 'h-screen' : ''}`}
    >
      <div className={`w-full ${isFullscreen ? 'h-screen' : 'h-[80vh]'} bg-gray-100`}>
        <object
          data={src}
          type="application/pdf"
          className="w-full h-full"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
        >
          <p>Your browser does not support PDFs. Please download the PDF to view it.</p>
        </object>
      </div>

      {/* Zoom Controls */}
      <div className="absolute top-4 left-4 flex gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors"
          aria-label="Zoom in"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors"
          aria-label="Zoom out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={handleReset}
          className="p-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors"
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
      />

      {/* Zoom Level Indicator */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
};

export default PDFViewer; 