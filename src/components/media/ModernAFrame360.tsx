import React, { useEffect, useRef, useState } from 'react';
import { AFrameScene } from '@/types/aframe';
import VRControls from './VRControls';
import VRCursor from './VRCursor';
import AFrameLoader from './AFrameLoader';
import { FaVrCardboard, FaExpand, FaCompress, FaUndo } from 'react-icons/fa';
import '@/styles/vr.css';

interface ModernAFrame360Props {
  src: string;
  isVideo?: boolean;
  hotspots?: Array<{
    position: string;
    rotation: string;
    text: string;
    onClick?: () => void;
  }>;
  onHotspotClick?: (index: number) => void;
  previewMode?: boolean;
}

const ModernAFrame360: React.FC<ModernAFrame360Props> = ({
  src,
  isVideo = false,
  hotspots = [],
  onHotspotClick,
  previewMode = false,
}) => {
  const sceneRef = useRef<AFrameScene>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVRMode, setIsVRMode] = useState(false);
  const [showVRMessage, setShowVRMessage] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (isVideo) {
      const video = videoRef.current;
      if (!video) return;

      const handleLoadedData = () => setIsLoading(false);
      const handleError = () => {
        setIsLoading(false);
        console.error('Error loading video');
      };

      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('error', handleError);

      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('error', handleError);
      };
    } else {
      const img = new Image();
      img.src = src;
      img.onload = () => setIsLoading(false);
      img.onerror = () => {
        setIsLoading(false);
        console.error('Error loading image');
      };
    }
  }, [src, isVideo]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          setZoom(prev => Math.min(prev + 0.1, 2));
          break;
        case 'ArrowDown':
          setZoom(prev => Math.max(prev - 0.1, 0.5));
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'r':
          resetView();
          break;
        case ' ':
          if (isVideo) togglePlayPause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isVideo]);

  useEffect(() => {
    if (isVideo && videoRef.current) {
      const video = videoRef.current;
      const updateTime = () => setCurrentTime(video.currentTime);
      const updateDuration = () => setDuration(video.duration);
      video.addEventListener('timeupdate', updateTime);
      video.addEventListener('durationchange', updateDuration);
      updateDuration();
      return () => {
        video.removeEventListener('timeupdate', updateTime);
        video.removeEventListener('durationchange', updateDuration);
      };
    }
  }, [isVideo, src]);

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
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const resetView = () => {
    const camera = document.querySelector('a-camera');
    if (camera) {
      camera.setAttribute('rotation', '0 0 0');
      setZoom(1);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (vol: number) => {
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setVolume(vol);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[25vh] md:min-h-[30vh] lg:min-h-[35vh]">
      <div 
        className="bg-gray-900 rounded-lg overflow-hidden w-full h-full" 
        style={{ 
          minHeight: '100%',
          aspectRatio: '16/9',
          maxHeight: 'calc(100vh - 400px)'
        }}
        onMouseMove={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        <AFrameLoader>
          <a-scene
            ref={sceneRef}
            embedded="true"
            loading-screen="enabled: false"
            vr-mode-ui="enabled: true"
            webxr="optionalFeatures: hand-tracking, hit-test, local-floor, bounded-floor, layers, dom-overlay; referenceSpaceType: local-floor"
            cursor="rayOrigin: mouse; fuse: false;"
            raycaster="objects: .clickable;"
            onEnterVR={() => setIsVRMode(true)}
            onExitVR={() => setIsVRMode(false)}
            className="w-full h-full"
            style={{ width: '100%', height: '100%' }}
          >
            {isVideo ? (
              <video
                id="video360"
                src={src}
                ref={videoRef}
                crossOrigin="anonymous"
                playsInline
                loop
                style={{ display: 'none' }}
              />
            ) : null}

            <a-sky
              src={isVideo ? '#video360' : src}
              rotation="0 -90 0"
              scale={`${zoom} ${zoom} ${zoom}`}
            />

            <a-camera position="0 1.6 0" look-controls="reverseMouseDrag: false">
              <VRCursor size={0.03} />
              <VRControls
                isVideo={isVideo}
                isPlaying={isPlaying}
                onPlayPause={togglePlayPause}
                volume={volume}
                onVolumeChange={handleVolumeChange}
                zoom={zoom}
                onZoomChange={setZoom}
                currentTime={currentTime}
                duration={duration}
                onSeek={handleSeek}
              />
            </a-camera>

            {hotspots.map((hotspot, index) => (
              <a-entity
                key={index}
                position={hotspot.position}
                rotation={hotspot.rotation}
                class="clickable"
                events={{
                  click: () => onHotspotClick?.(index),
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
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-40">
            <div className="animate-spin rounded-full h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10 border-t-2 border-b-2 border-white" />
          </div>
        )}

        {showControls && (
          <div className="absolute top-14 right-3 flex flex-col items-center gap-2 transition-all duration-300">
            <button
              className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-all shadow-md"
              onClick={() => handleVRModeChange(!isVRMode)}
              aria-label="Toggle VR mode"
              title="View in VR"
            >
              <FaVrCardboard className="text-[10px]" />
            </button>
            {!previewMode && (
              <button
                className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-all shadow-md"
                onClick={toggleFullscreen}
                aria-label="Toggle fullscreen"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? 
                  <FaCompress className="text-[10px]" /> : 
                  <FaExpand className="text-[10px]" />
                }
              </button>
            )}
            <button
              className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-all shadow-md"
              onClick={resetView}
              aria-label="Reset view"
              title="Reset View"
            >
              <FaUndo className="text-[10px]" />
            </button>
          </div>
        )}

        {isVideo && !isPlaying && (
          <button
            className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 hover:bg-black/60 transition-colors"
            style={{ pointerEvents: 'auto' }}
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.play();
                setIsPlaying(true);
              }
            }}
          >
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="32" cy="32" r="32" fill="rgba(0,0,0,0.7)" />
              <polygon points="26,20 50,32 26,44" fill="#fff" />
            </svg>
          </button>
        )}

        {showVRMessage && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-xs">
            VR mode requires a compatible headset
          </div>
        )}
      </div>
    </div>
  );
};

export default ModernAFrame360;