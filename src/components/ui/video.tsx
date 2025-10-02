import React, { useState, useRef } from 'react';

interface VideoProps {
  src: string
  thumbnail?: string
  className?: string
  controls?: boolean
  watermark?: React.ReactNode
}

export function Video({ src, thumbnail, className, controls = true, watermark }: VideoProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    setShowVideo(true);
    setTimeout(() => {
      videoRef.current?.play();
    }, 0);
  };

  // Handle fullscreen events
  const handleFullscreenChange = () => {
    const isFull = document.fullscreenElement === videoRef.current ||
      (document as any).webkitFullscreenElement === videoRef.current;
    setIsFullscreen(isFull);
  };

  // Add fullscreen event listeners when video is shown
  React.useEffect(() => {
    if (showVideo && videoRef.current) {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      
      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      };
    }
  }, [showVideo]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        borderRadius: '0.75rem',
        background: '#000',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      {!showVideo && (
        <div
          style={{ cursor: 'pointer', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          onClick={handlePlay}
        >
          {thumbnail ? (
            <img
              src={thumbnail}
              alt="Video thumbnail"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderRadius: '0.75rem',
                background: '#000',
              }}
            />
          ) : (
            <video
              ref={videoRef}
              src={src}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderRadius: '0.75rem',
                background: '#000',
              }}
              playsInline
              preload="metadata"
              controls={false}
              muted
              onLoadedMetadata={() => videoRef.current && (videoRef.current.currentTime = 0)}
            />
          )}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
              }}
            >
              <svg width={36} height={36} viewBox="0 0 24 24" fill="currentColor" style={{ color: '#222', marginLeft: 6 }}>
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      )}
      {showVideo && (
        <video
          ref={videoRef}
          src={src}
          poster={thumbnail}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: '0.75rem',
            background: '#000',
          }}
          controls={controls}
          playsInline
          autoPlay
        />
      )}
      
      {/* Fullscreen watermark overlay */}
      {isFullscreen && watermark && (
        <div className="fixed inset-0 z-[40] pointer-events-none">
          {watermark}
        </div>
      )}
    </div>
  );
} 