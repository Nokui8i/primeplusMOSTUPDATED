import React, { useEffect, useRef, useState } from 'react';
import { Entity } from 'aframe';
import VRControls from './VRControls';
import VRCursor from './VRCursor';
import AFrameLoader from './AFrameLoader';
import { FaVrCardboard, FaExpand, FaCompress, FaUndo, FaMousePointer, FaArrowsAlt } from 'react-icons/fa';
import '@/styles/vr.css';

// Import A-Frame only on client side
if (typeof window !== 'undefined') {
  require('aframe');
}

interface Hotspot {
  id: string;
  position: string;
  rotation?: string;
  text: string;
}

interface AFrameImage360Props {
  imageUrl: string;
  isVideo?: boolean;
  onError?: (error: Error) => void;
  hotspots?: Hotspot[];
  onHotspotClick?: (hotspotId: string) => void;
  previewMode?: boolean;
}

interface AFrameScene extends Entity {
  enterVR: () => void;
  exitVR: () => void;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'a-scene': any;
      'a-sky': any;
      'a-entity': any;
      'a-camera': any;
      'a-text': any;
      'a-sphere': any;
    }
  }
}

const AFrameImage360: React.FC<AFrameImage360Props> = ({
  imageUrl,
  isVideo = false,
  onError,
  hotspots = [],
  onHotspotClick,
  previewMode = false
}) => {
  const sceneRef = useRef<AFrameScene>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(1);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [volume, setVolume] = React.useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isVRMode, setIsVRMode] = useState(false);
  const [showVRMessage, setShowVRMessage] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string>('');

  useEffect(() => {
    // Preload the image to handle CORS
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Create a canvas to process the image
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const processedUrl = canvas.toDataURL('image/jpeg');
        setProcessedImageUrl(processedUrl);
        setIsLoading(false);
      }
    };

    img.onerror = (error) => {
      console.error('Error loading 360 image:', error);
      onError?.(new Error('Failed to load 360 image'));
      setIsLoading(false);
    };

    img.src = imageUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl, onError]);

  // Lazy loading using Intersection Observer
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setShowControls(true);
          } else {
            setShowControls(false);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    if (sceneRef.current) {
      sceneRef.current.setAttribute('scale', `${newZoom} ${newZoom} ${newZoom}`);
    }
  };

  const handlePlayPause = () => {
    if (isVideo && sceneRef.current) {
      const video = sceneRef.current.components.material.material.map.image;
      if (video) {
        if (isPlaying) {
          video.pause();
        } else {
          video.play();
        }
        setIsPlaying(!isPlaying);
      }
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (isVideo && sceneRef.current) {
      const video = sceneRef.current.components.material.material.map.image;
      if (video) {
        video.volume = newVolume;
      }
    }
  };

  const handleVRModeChange = async (enabled: boolean) => {
    try {
      if (enabled) {
        if ('xr' in navigator) {
          const supported = await (navigator as any).xr.isSessionSupported('immersive-vr');
          if (!supported) {
            setShowVRMessage(true);
            setTimeout(() => setShowVRMessage(false), 3000);
            return;
          }
        }
        await sceneRef.current?.enterVR();
      } else {
        await sceneRef.current?.exitVR();
      }
      setIsVRMode(enabled);
    } catch (error) {
      console.warn('VR mode change failed:', error);
      setShowVRMessage(true);
      setTimeout(() => setShowVRMessage(false), 3000);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const resetView = () => {
    const camera = document.querySelector('a-camera');
    if (camera) {
      camera.setAttribute('rotation', '0 0 0');
      setZoom(1);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full ${previewMode ? 'h-[300px]' : 'h-[500px]'}`}
    >
      <div 
        className="bg-gray-900 rounded-lg overflow-hidden h-full"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => !isInteracting && setShowControls(false)}
        onMouseDown={() => setIsInteracting(true)}
        onMouseUp={() => setIsInteracting(false)}
        onTouchStart={() => setIsInteracting(true)}
        onTouchEnd={() => setIsInteracting(false)}
      >
        <AFrameLoader>
          <a-scene
            ref={sceneRef}
            embedded
            vr-mode-ui="enabled: false"
            renderer="antialias: true; precision: medium"
            device-orientation-permission-ui="enabled: false"
            cursor="rayOrigin: mouse; fuse: false;"
            raycaster="objects: .clickable;"
            onEnterVR={() => setIsVRMode(true)}
            onExitVR={() => setIsVRMode(false)}
            className="w-full h-full"
          >
            <a-assets>
              <img id="sky" crossOrigin="anonymous" src={processedImageUrl || imageUrl} />
            </a-assets>

            <a-sky
              src="#sky"
              rotation="0 -90 0"
              material="shader: flat; src: #sky"
            />

            <a-camera 
              position="0 1.6 0" 
              look-controls="reverseMouseDrag: true"
              wasd-controls="enabled: false"
            >
              <VRCursor size={0.03} />
              {!previewMode && (
                <VRControls
                  isVideo={isVideo}
                  zoom={zoom}
                  onZoomChange={handleZoomChange}
                  isPlaying={isPlaying}
                  onPlayPause={handlePlayPause}
                  volume={volume}
                  onVolumeChange={handleVolumeChange}
                />
              )}
            </a-camera>

            {hotspots.map((hotspot) => (
              <a-entity
                key={hotspot.id}
                position={hotspot.position}
                rotation={hotspot.rotation}
                class="clickable"
                events={{
                  click: () => onHotspotClick?.(hotspot.id),
                }}
              >
                <a-sphere
                  radius="0.2"
                  color="#4A90E2"
                  opacity="0.8"
                  animation="property: scale; to: 1.2 1.2 1.2; dir: alternate; dur: 1000; loop: true"
                />
                <a-text
                  value={hotspot.text}
                  align="center"
                  position="0 0.3 0"
                  scale="0.5 0.5 0.5"
                  color="white"
                  width={2}
                />
              </a-entity>
            ))}
          </a-scene>
        </AFrameLoader>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white text-lg font-semibold">Loading 360° image...</p>
            </div>
          </div>
        )}

        {/* Interaction Hint Overlay */}
        {!isInteracting && showControls && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black bg-opacity-50 rounded-full p-6 transform transition-transform animate-pulse">
              <FaArrowsAlt className="text-white text-4xl opacity-75" />
            </div>
          </div>
        )}

        {/* Floating Controls */}
        {showControls && (
          <div 
            className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black bg-opacity-50 rounded-lg p-3 transition-all duration-300 ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <button
              className="vr-control-icon group relative"
              onClick={() => handleVRModeChange(!isVRMode)}
              aria-label="Toggle VR mode"
            >
              <FaVrCardboard />
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                View in VR
              </span>
            </button>
            {!previewMode && (
              <button
                className="vr-control-icon group relative"
                onClick={toggleFullscreen}
                aria-label="Toggle fullscreen"
              >
                {isFullscreen ? <FaCompress /> : <FaExpand />}
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                </span>
              </button>
            )}
            <button
              className="vr-control-icon group relative"
              onClick={resetView}
              aria-label="Reset view"
            >
              <FaUndo />
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Reset View
              </span>
            </button>
          </div>
        )}

        {/* Help Text */}
        {!previewMode && showControls && (
          <div className="absolute bottom-20 left-4 text-white text-sm bg-black bg-opacity-30 rounded px-3 py-1 transition-opacity duration-300">
            <div className="flex items-center gap-2">
              <FaMousePointer className="text-lg" />
              <span>Drag to look around • Double-click for VR mode</span>
            </div>
          </div>
        )}
      </div>

      {/* VR Support Message */}
      {showVRMessage && (
        <div className="vr-message">
          VR mode requires a compatible headset
        </div>
      )}
    </div>
  );
};

export default AFrameImage360;