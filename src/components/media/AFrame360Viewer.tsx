import React, { useState, useRef, useEffect } from 'react';
import AFrameLoader from './AFrameLoader';
import VRCursor from './VRCursor';
import { FaVrCardboard, FaCompress, FaExpand } from 'react-icons/fa';
import { MediaValidationResult } from '../../utils/mediaValidation';
import '../../styles/vr.css';
import VRControls from './VRControls';

export interface Hotspot {
  id: string;
  position: string;
  rotation?: string;
  text: string;
  onClick?: () => void;
}

interface AFrame360ViewerProps {
  src: string;
  type: '360-image' | '360-video';
  hotspots?: Hotspot[];
  onHotspotClick?: (hotspotId: string) => void;
  className?: string;
  metadata?: MediaValidationResult['metadata'];
  onError?: (error: string) => void;
  previewMode?: boolean;
}

const AFrame360Viewer: React.FC<AFrame360ViewerProps> = ({
  src,
  type,
  hotspots = [],
  onHotspotClick,
  className = '',
  metadata,
  onError,
  previewMode = false
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isVRMode, setIsVRMode] = useState(false);
  const [showVRMessage, setShowVRMessage] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleAssetLoad = () => setIsLoading(false);
    const handleAssetError = (error: string) => {
      setIsLoading(false);
      onError?.(error);
    };

    if (type === '360-video' && videoRef.current) {
      videoRef.current.addEventListener('loadeddata', handleAssetLoad);
      videoRef.current.addEventListener('error', () => handleAssetError('Failed to load video'));

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadeddata', handleAssetLoad);
          videoRef.current.removeEventListener('error', () => handleAssetError('Failed to load video'));
        }
      };
    } else {
      const img = new Image();
      img.src = src;
      img.onload = handleAssetLoad;
      img.onerror = () => handleAssetError('Failed to load image');
    }
  }, [type, src, onError]);

  const handlePlayPause = () => {
    if (type !== '360-video' || !videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (newVolume: number) => {
    if (type !== '360-video' || !videoRef.current) return;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
  };

  const handleVRModeChange = async (enabled: boolean) => {
    try {
      if (enabled) {
        // Check VR support when user tries to enter VR
        if ('xr' in navigator) {
          const supported = await (navigator as any).xr.isSessionSupported('immersive-vr');
          if (!supported) {
            setShowVRMessage(true);
            setTimeout(() => setShowVRMessage(false), 3000);
            return;
          }
        }
        sceneRef.current?.enterVR();
      } else {
        sceneRef.current?.exitVR();
      }
      setIsVRMode(enabled);
    } catch (error) {
      console.warn('VR mode change failed:', error);
      setShowVRMessage(true);
      setTimeout(() => setShowVRMessage(false), 3000);
    }
  };

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full ${className} ${isFullscreen ? 'fullscreen' : ''}`}
      style={isFullscreen ? { width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 10000 } : {}}
    >
      <AFrameLoader>
        <a-scene
          ref={sceneRef}
          embedded
          loading-screen="enabled: false"
          vr-mode-ui="enabled: false"
          className="w-full bg-gray-900"
          style={isFullscreen ? { width: '100vw', height: '100vh' } : { minHeight: '400px', width: '100%', height: '400px' }}
          webxr="optionalFeatures: hand-tracking, hit-test, local-floor, bounded-floor, layers, dom-overlay; referenceSpaceType: local-floor"
          cursor="rayOrigin: mouse; fuse: false;"
          raycaster="objects: .clickable;"
          physics={"driver: local" as any}
          onEnterVR={() => setIsVRMode(true)}
          onExitVR={() => setIsVRMode(false)}
        >
          {/* Camera setup with cursor */}
          <a-entity
            position="0 1.6 0"
            camera={true as any}
            look-controls="pointerLockEnabled: true"
            wasd-controls="enabled: false"
          >
            <VRCursor color="#4A90E2" size={0.03} />
            {!previewMode && (
              <VRControls
                isVideo={type === '360-video'}
                zoom={zoom}
                onZoomChange={setZoom}
                isPlaying={isPlaying}
                onPlayPause={type === '360-video' ? handlePlayPause : undefined}
                volume={volume}
                onVolumeChange={type === '360-video' ? handleVolumeChange : undefined}
              />
            )}
          </a-entity>

          {/* Content (360 photo or video) */}
          {type === '360-video' ? (
            <>
              <video
                ref={videoRef}
                id="video"
                src={src}
                crossOrigin="anonymous"
                playsInline
                webkit-playsinline="true"
                style={{ display: 'none' }}
              />
              <a-videosphere
                src="#video"
                rotation="0 -90 0"
                play-on-click
                className="clickable"
              />
            </>
          ) : (
            <a-sky 
              src={src}
              rotation="0 -90 0"
              className="clickable"
            />
          )}

          {/* Hotspots */}
          {hotspots.map((hotspot, index) => (
            <a-entity
              key={index}
              position={hotspot.position}
              rotation={hotspot.rotation || "0 0 0"}
              className="clickable vr-hotspot"
              onClick={() => onHotspotClick?.(hotspot.id)}
            >
              <a-sphere
                radius="0.2"
                color="#4A90E2"
                opacity="0.8"
                animation="property: opacity; dir: alternate; dur: 1000; loop: true; to: 0.4"
              />
              <a-text
                value={hotspot.text}
                align="center"
                position="0 0.3 0"
                scale="0.5 0.5 0.5"
                color="white"
                className="vr-hotspot-text"
              />
            </a-entity>
          ))}

          {/* VR Controls */}
          {/* VR Controls are removed as per the instructions */}
        </a-scene>
      </AFrameLoader>

      {/* VR Button */}
      <button 
        className="vr-button"
        onClick={() => handleVRModeChange(!isVRMode)}
        aria-label="Toggle VR mode"
      >
        <FaVrCardboard />
      </button>

      {/* Fullscreen Button - only show if not previewMode */}
      {!previewMode && (
        <button 
          className="fullscreen-button"
          onClick={toggleFullscreen}
          aria-label="Toggle fullscreen"
          style={{ position: 'absolute', top: 16, right: 16, zIndex: 10001 }}
        >
          {isFullscreen ? <FaCompress /> : <FaExpand />}
        </button>
      )}

      {/* Loading and metadata indicators */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
          <div className="text-white text-lg font-semibold">
            Loading {type === '360-video' ? 'Video' : 'Image'}...
          </div>
        </div>
      )}

      {metadata && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white text-sm px-3 py-1 rounded">
          {metadata.width}x{metadata.height}
          {metadata.duration ? ` • ${Math.round(metadata.duration)}s` : ''}
        </div>
      )}

      {/* VR Message - only shows when user tries to enter VR without support */}
      {showVRMessage && (
        <div className="vr-message">
          VR mode requires a compatible headset
        </div>
      )}

      {/* Instructions */}
      <div className="vr-help-text">
        Use mouse to look around • Click VR button for immersive mode
      </div>
    </div>
  );
};

export default AFrame360Viewer; 