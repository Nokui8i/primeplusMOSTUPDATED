import React, { useEffect, useRef, useState } from 'react';
import VRControls from './VRControls';
import VRCursor from './VRCursor';
import AFrameLoader from './AFrameLoader';
import { SmoothTimeline } from '@/components/ui/SmoothTimeline';
import { FaVrCardboard, FaExpand, FaCompress, FaUndo, FaMousePointer, FaArrowsAlt, FaPlay, FaPause, FaVolumeDown, FaVolumeUp } from 'react-icons/fa';
import '@/styles/vr.css';
import '@/styles/slider.css';

// Import A-Frame only on client side
if (typeof window !== 'undefined') {
  require('aframe');
}

interface AFrameVideo360Props {
  src: string;
  hotspots?: Array<{
    position: string;
    rotation: string;
    text: string;
    onClick?: () => void;
  }>;
  onHotspotClick?: (index: number) => void;
  previewMode?: boolean;
}

interface AFrameScene extends HTMLElement {
  enterVR: () => void;
  exitVR: () => void;
}

const AFrameVideo360: React.FC<AFrameVideo360Props> = ({ 
  src, 
  hotspots = [], 
  onHotspotClick,
  previewMode = false 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<AFrameScene>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isVRMode, setIsVRMode] = useState(false);
  const [showVRMessage, setShowVRMessage] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Lazy loading using Intersection Observer
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setShowControls(true);
            // Auto-play preview when in view (muted)
            if (previewMode && videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().catch(() => {
                // Auto-play failed (mobile devices often block it)
                console.log('Auto-play prevented');
              });
            }
          } else {
            setShowControls(false);
            if (videoRef.current) {
              videoRef.current.pause();
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [previewMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      setIsLoading(false);
    };

    const handleError = () => {
      setIsLoading(false);
      console.error('Error loading video');
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Ensure timeline updates when video plays with smooth animation
  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      let animationId: number;
      
      const updateTime = () => {
        if (video && !video.paused) {
          setCurrentTime(video.currentTime);
          animationId = requestAnimationFrame(updateTime);
        }
      };
      
      const handleTimeUpdateEvent = () => {
        if (!animationId) {
          animationId = requestAnimationFrame(updateTime);
        }
      };
      
      const handleLoadedMetadataEvent = () => {
        setDuration(video.duration);
      };

      const handlePlay = () => {
        animationId = requestAnimationFrame(updateTime);
      };

      const handlePause = () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = 0;
        }
      };

      video.addEventListener('timeupdate', handleTimeUpdateEvent);
      video.addEventListener('loadedmetadata', handleLoadedMetadataEvent);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      
      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
        video.removeEventListener('timeupdate', handleTimeUpdateEvent);
        video.removeEventListener('loadedmetadata', handleLoadedMetadataEvent);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
      };
    }
  }, []);

  // Fallback: Set default duration if not loaded
  useEffect(() => {
    if (isPlaying && duration === 0) {
      setDuration(120); // Default 2 minute duration
    }
  }, [isPlaying, duration]);

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
  };

  const toggleVR = () => {
    if (sceneRef.current) {
      if (!isVRMode) {
        sceneRef.current.enterVR();
      } else {
        sceneRef.current.exitVR();
      }
      setIsVRMode(!isVRMode);
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
    <div ref={containerRef} className="relative w-full">
      {/* VR Mode Toggle Button - Now more prominent */}
      <button
        onClick={toggleVR}
        className="absolute top-4 right-4 z-20 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-lg transition-all duration-200 transform hover:scale-105"
      >
        <FaVrCardboard className="text-xl" />
        <span>{isVRMode ? 'Exit VR' : 'Enter VR'}</span>
      </button>

      {/* Main Controls - Now more visible */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex space-x-4">
        <button
          onClick={handlePlayPause}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg"
        >
          {isPlaying ? <FaPause /> : <FaPlay />}
        </button>
        <div className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg">
          <button onClick={() => handleVolumeChange(Math.max(0, volume - 0.1))}>
            <FaVolumeDown />
          </button>
          <span>{Math.round(volume * 100)}%</span>
          <button onClick={() => handleVolumeChange(Math.min(1, volume + 0.1))}>
            <FaVolumeUp />
          </button>
        </div>
        <div className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg">
          <button onClick={() => handleZoomChange(Math.max(0.5, zoom - 0.1))}>
            <FaCompress />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => handleZoomChange(Math.min(2, zoom + 0.1))}>
            <FaExpand />
          </button>
        </div>
        {/* Fullscreen Button - only show if not previewMode */}
        {!previewMode && (
          <button
            onClick={toggleFullscreen}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg"
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? <FaCompress /> : <FaExpand />}
          </button>
        )}
      </div>

      {/* Timeline Controls */}
      {!previewMode && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Timeline */}
          <div className="mb-4">
            <SmoothTimeline
              currentTime={currentTime}
              duration={duration}
              onSeek={seekTo}
            />
          </div>
          
          {/* Controls */}
          <div className="flex justify-center items-center space-x-4">
            <button
              onClick={handlePlayPause}
              className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition-colors"
            >
              {isPlaying ? <FaPause /> : <FaPlay />}
            </button>
            
            <div className="flex items-center space-x-2">
              <FaVolumeDown className="text-white text-sm" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
              />
              <FaVolumeUp className="text-white text-sm" />
            </div>
          </div>
        </div>
      )}

      <div className="w-full" style={{ minHeight: '400px', backgroundColor: '#000' }}>
        <AFrameLoader>
          <a-scene
            ref={sceneRef}
            embedded
            loading-screen="enabled: false"
            vr-mode-ui="enabled: true"
            className="w-full h-full"
          >
            <a-assets>
              <video
                ref={videoRef}
                id="video"
                src={src}
                crossOrigin="anonymous"
                playsInline
                preload="auto"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
              />
            </a-assets>

            <a-videosphere src="#video" rotation="0 -90 0" />

            <a-camera position="0 1.6 0">
              <VRCursor color="#4A90E2" size={0.03} />
            </a-camera>

            <VRControls
              isVideo={true}
              zoom={zoom}
              onZoomChange={handleZoomChange}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              volume={volume}
              onVolumeChange={handleVolumeChange}
            />

            {hotspots.map((hotspot, index) => (
              <a-entity
                key={index}
                position={hotspot.position}
                rotation={hotspot.rotation}
                class="clickable"
                events={{
                  click: () => onHotspotClick && onHotspotClick(index),
                }}
              >
                <a-sphere
                  radius="0.2"
                  material="color: #4A90E2; opacity: 0.8"
                  animation="property: scale; to: 1.2 1.2 1.2; dir: alternate; dur: 1000; loop: true"
                />
                <a-text
                  value={hotspot.text}
                  align="center"
                  position="0 0.3 0"
                  scale="0.5 0.5 0.5"
                  color="#ffffff"
                />
              </a-entity>
            ))}
          </a-scene>
        </AFrameLoader>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
            <div className="text-white text-lg font-semibold">Loading video...</div>
          </div>
        )}

        {/* Instructions overlay */}
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 text-white text-center bg-black bg-opacity-50 px-4 py-2 rounded-lg z-10">
          <p>Use mouse to look around • Click VR button for immersive mode</p>
        </div>
      </div>
    </div>
  );
};

export default AFrameVideo360;