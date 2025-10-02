'use client';

import { useEffect, useRef, useState, forwardRef } from 'react';
import GoogleVRView from './GoogleVRView';
import { SmoothTimeline } from '@/components/ui/SmoothTimeline';
import '@/styles/slider.css';

interface QualityOption {
  label: string;
  file: string;
}

interface GoogleVRVideoViewProps {
  src: string;
  width?: string;
  height?: string;
  isStereo?: boolean;
  isDebug?: boolean;
  isVROff?: boolean;
  isAutopanOff?: boolean;
  defaultYaw?: number;
  isYawOnly?: boolean;
  className?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  qualities?: QualityOption[];
  onReady?: () => void;
  onError?: (error: any) => void;
  onModeChange?: (mode: string) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

const GoogleVRVideoView = forwardRef<any, GoogleVRVideoViewProps>(({
  src,
  width = '100%',
  height = '400px',
  isStereo = false,
  isDebug = false,
  isVROff = false,
  isAutopanOff = false,
  defaultYaw,
  isYawOnly = false,
  className = '',
  autoplay = false,
  muted = false,
  loop = false,
  qualities,
  onReady,
  onError,
  onModeChange,
  onPlay,
  onPause,
  onEnded
}, ref) => {
  const vrViewRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(muted ? 0 : 1);
  const [isTimelineActive, setIsTimelineActive] = useState(false);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleReady = () => {
    setIsReady(true);
    onReady?.();
    
    // For Google VR View, we'll use a polling approach since we can't access iframe content
    setIsTimelineActive(true);
    
    // Auto-play if requested
    if (autoplay && vrViewRef.current) {
      setTimeout(() => {
        vrViewRef.current.play();
      }, 100);
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
    onPlay?.();
  };

  const handlePause = () => {
    setIsPlaying(false);
    onPause?.();
  };

  const handleEnded = () => {
    setIsPlaying(false);
    onEnded?.();
  };

  // Expose video control methods
  const play = () => {
    if (vrViewRef.current) {
      vrViewRef.current.play();
      handlePlay();
    }
  };

  const pause = () => {
    if (vrViewRef.current) {
      vrViewRef.current.pause();
      handlePause();
    }
  };

  const setVolume = (newVolume: number) => {
    setVolumeState(newVolume);
    if (vrViewRef.current) {
      vrViewRef.current.setVolume(newVolume);
    }
  };

  const seekTo = (time: number) => {
    if (vrViewRef.current) {
      vrViewRef.current.seekTo(time);
      setCurrentTime(time);
    }
  };

  const handleTimeUpdate = () => {
    if (vrViewRef.current) {
      const time = vrViewRef.current.getCurrentTime();
      setCurrentTime(time);
    }
  };

  const handleDurationChange = () => {
    if (vrViewRef.current) {
      const dur = vrViewRef.current.getDuration();
      setDuration(dur);
    }
  };

  // Smooth animation for timeline updates (since we can't access iframe video directly)
  useEffect(() => {
    if (!isTimelineActive || !isPlaying) return;

    let animationId: number;
    let lastTime = 0;
    
    const animate = (currentTime: number) => {
      if (!isPlaying) return;
      
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      // Update every 16ms (60fps) for smooth movement
      if (deltaTime >= 16) {
        setCurrentTime(prev => {
          const newTime = prev + (deltaTime / 1000); // Convert to seconds
          if (duration > 0 && newTime >= duration) {
            setIsPlaying(false);
            onEnded?.();
            return duration;
          }
          return newTime;
        });
      }
      
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isTimelineActive, isPlaying, duration, onEnded]);

  // Set a default duration for Google VR View (since we can't get it directly)
  useEffect(() => {
    if (isReady && duration === 0) {
      setDuration(120); // Default 2 minute duration for VR videos
    }
  }, [isReady, duration]);

  // Reset timeline when video starts playing
  useEffect(() => {
    if (isPlaying && currentTime === 0) {
      setCurrentTime(0);
    }
  }, [isPlaying, currentTime]);

  // Expose methods via ref
  useEffect(() => {
    if (ref && typeof ref === 'object' && ref.current) {
      (ref.current as any).play = play;
      (ref.current as any).pause = pause;
      (ref.current as any).setVolume = setVolume;
      (ref.current as any).seekTo = seekTo;
      (ref.current as any).getCurrentTime = () => currentTime;
      (ref.current as any).getDuration = () => duration;
    }
  }, [isReady, ref, currentTime, duration]);

  return (
    <div className={`relative ${className}`}>
      <GoogleVRView
        src={src}
        type="video"
        width={width}
        height={height}
        isStereo={isStereo}
        onReady={handleReady}
        onError={onError}
      />
      
      {/* Custom video controls overlay */}
      {isReady && (
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
              onClick={isPlaying ? pause : play}
              className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition-colors"
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            
            <div className="flex items-center space-x-2">
              <span className="text-white text-sm">🔊</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

GoogleVRVideoView.displayName = 'GoogleVRVideoView';

export default GoogleVRVideoView;
