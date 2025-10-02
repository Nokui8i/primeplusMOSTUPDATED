import React, { useState, useEffect } from 'react';

interface FullScreenButtonProps {
  targetRef: React.RefObject<HTMLElement>;
  className?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onFullScreenChange?: (isFullScreen: boolean) => void;
}

const FullScreenButton: React.FC<FullScreenButtonProps> = ({
  targetRef,
  className = '',
  position = 'bottom-right',
  onFullScreenChange
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const newIsFullscreen = document.fullscreenElement !== null;
      setIsFullscreen(newIsFullscreen);
      onFullScreenChange?.(newIsFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [onFullScreenChange]);

  const toggleFullscreen = async () => {
    if (!targetRef.current) return;

    try {
      if (!isFullscreen) {
        await targetRef.current.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  return (
    <button
      onClick={toggleFullscreen}
      className={`
        absolute z-50 px-3 py-2 
        bg-gray-800 hover:bg-gray-700 
        text-white rounded-lg 
        transition-colors flex items-center gap-2 
        shadow-lg backdrop-blur-sm bg-opacity-80
        ${positionClasses[position]}
        ${className}
      `}
      style={{
        minWidth: '44px',
        minHeight: '44px',
      }}
      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
    >
      {isFullscreen ? (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6v6H9z" />
          </svg>
          <span className="hidden sm:inline">Exit Full</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0 0l-5-5m-7 11h4m-4 0v4m0-4l5 5m11-5h-4m4 0v4m0-4l-5 5" />
          </svg>
          <span className="hidden sm:inline">Full Screen</span>
        </>
      )}
    </button>
  );
};

export default FullScreenButton; 