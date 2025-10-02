import React, { useState, useEffect, useRef } from 'react';
import VRCursor from './VRCursor';
import AFrameLoader from './AFrameLoader';
import { FaExpand, FaCompress, FaVrCardboard } from 'react-icons/fa';
import '../../styles/vr.css';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'a-scene': any;
      'a-entity': any;
      'a-camera': any;
      'a-sky': any;
      'a-sphere': any;
      'a-text': any;
      'a-assets': any;
      'a-videosphere': any;
    }
  }
}

export interface Hotspot {
  position: string;
  rotation?: string;
  text: string;
  onClick?: () => void;
}

interface EmbeddedAFrame360Props {
  src: string;
  isVideo?: boolean;
  hotspots?: Hotspot[];
  onHotspotClick?: (index: number) => void;
  className?: string;
}

const EmbeddedAFrame360: React.FC<EmbeddedAFrame360Props> = ({
  src,
  isVideo = false,
  hotspots = [],
  onHotspotClick,
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isVRMode, setIsVRMode] = useState(false);
  const [isVRSupported, setIsVRSupported] = useState<'checking' | 'supported' | 'unsupported'>('checking');
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<any>(null);

  // Check VR support
  useEffect(() => {
    const checkVRSupport = async () => {
      try {
        if ('xr' in navigator) {
          const supported = await (navigator as any).xr.isSessionSupported('immersive-vr');
          setIsVRSupported(supported ? 'supported' : 'unsupported');
        } else if ('getVRDisplays' in navigator) {
          const displays = await (navigator as any).getVRDisplays();
          setIsVRSupported(displays.length > 0 ? 'supported' : 'unsupported');
        } else {
          setIsVRSupported('unsupported');
        }
      } catch (error) {
        console.warn('VR Support check failed:', error);
        setIsVRSupported('unsupported');
      }
    };

    checkVRSupport();
  }, []);

  useEffect(() => {
    const handleAssetLoad = () => setIsLoading(false);
    const handleAssetError = () => {
      console.error('Failed to load 360 asset');
      setIsLoading(false);
    };

    if (isVideo && videoRef.current) {
      videoRef.current.addEventListener('loadeddata', handleAssetLoad);
      videoRef.current.addEventListener('error', handleAssetError);

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadeddata', handleAssetLoad);
          videoRef.current.removeEventListener('error', handleAssetError);
        }
      };
    } else {
      const img = new Image();
      img.src = src;
      img.onload = handleAssetLoad;
      img.onerror = handleAssetError;
    }
  }, [isVideo, src]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const handlePlayPause = () => {
    if (!isVideo || !videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!isVideo || !videoRef.current) return;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
  };

  const handleFullscreen = () => {
    const scene = document.querySelector('a-scene');
    if (!scene) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (scene.requestFullscreen) {
      scene.requestFullscreen();
    } else if ((scene as any).webkitRequestFullscreen) {
      (scene as any).webkitRequestFullscreen();
    } else if ((scene as any).mozRequestFullScreen) {
      (scene as any).mozRequestFullScreen();
    } else if ((scene as any).msRequestFullscreen) {
      (scene as any).msRequestFullscreen();
    }
  };

  const handleVRModeChange = (enabled: boolean) => {
    setIsVRMode(enabled);
    if (sceneRef.current) {
      if (enabled) {
        sceneRef.current.enterVR();
      } else {
        sceneRef.current.exitVR();
      }
    }
  };

  return (
    <div className={`relative w-full aspect-[16/9] bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      <AFrameLoader>
        <a-scene 
          ref={sceneRef}
          embedded
          loading-screen="enabled: false"
          vr-mode-ui="enabled: true"
          className="w-full h-full"
          webxr="optionalFeatures: hand-tracking, hit-test, local-floor, bounded-floor, layers, dom-overlay; referenceSpaceType: local-floor"
          cursor="rayOrigin: mouse; fuse: false;"
          raycaster="objects: .clickable;"
          onEnterVR={() => handleVRModeChange(true)}
          onExitVR={() => handleVRModeChange(false)}
        >
          {isVideo ? (
            <>
              <a-assets>
                <video
                  ref={videoRef}
                  id="video360"
                  src={src}
                  crossOrigin="anonymous"
                  playsInline
                  preload="auto"
                  loop
                />
              </a-assets>
              <a-videosphere 
                src="#video360"
                rotation="0 -90 0"
              />
            </>
          ) : (
            <a-sky 
              src={src}
              rotation="0 -90 0"
            />
          )}

          <a-camera position="0 1.6 0" look-controls="reverseMouseDrag: true">
            <VRCursor color="#4A90E2" size={0.03} />
          </a-camera>

          {hotspots.map((hotspot, index) => (
            <a-entity
              key={index}
              position={hotspot.position}
              rotation={hotspot.rotation || "0 0 0"}
              class="clickable"
              onClick={() => onHotspotClick?.(index)}
            >
              <a-sphere
                radius="0.3"
                material="color: #4A90E2; opacity: 0.8"
                animation__mouseenter="property: material.opacity; to: 1; dur: 200; startEvents: mouseenter"
                animation__mouseleave="property: material.opacity; to: 0.8; dur: 200; startEvents: mouseleave"
              />
              {hotspot.text && (
                <a-text
                  value={hotspot.text}
                  align="center"
                  position="0 0.5 0"
                  scale="0.5 0.5 0.5"
                  color="#FFFFFF"
                  opacity="1"
                />
              )}
            </a-entity>
          ))}
        </a-scene>
      </AFrameLoader>

      {/* VR Support Status */}
      <div className={`vr-mode-status ${isVRSupported === 'supported' ? 'available' : 'unavailable'}`}>
        <FaVrCardboard />
        {isVRSupported === 'checking' && 'Checking VR Support...'}
        {isVRSupported === 'supported' && 'VR Ready'}
        {isVRSupported === 'unsupported' && 'VR Not Available'}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white text-lg font-semibold">
            Loading {isVideo ? 'Video' : 'Image'}...
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="vr-instructions">
        Use mouse to look around • {isVRSupported === 'supported' ? 'Click VR button for immersive mode' : 'VR mode not available'}
      </div>

      {/* Fullscreen toggle */}
      <button
        onClick={handleFullscreen}
        className="absolute top-4 right-4 text-white bg-black bg-opacity-50 p-2 rounded-lg hover:bg-opacity-70 transition-all"
      >
        {isFullscreen ? <FaCompress /> : <FaExpand />}
      </button>
    </div>
  );
};

export default EmbeddedAFrame360; 