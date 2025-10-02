import React, { useRef, useState, useEffect } from 'react';
import Hls from 'hls.js';
import FullScreenButton from '../common/FullScreenButton';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { toast } from 'react-hot-toast';
import { createPortal } from 'react-dom';

interface SubtitleTrack {
  src: string;
  label: string;
  lang: string;
  default?: boolean;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  onError?: (error: Error | MediaError | null) => void;
  subtitles?: SubtitleTrack[];
}

export function VideoPlayer({
  src,
  poster,
  className = '',
  autoPlay = false,
  loop = false,
  muted = true,
  controls = true,
  onError,
  subtitles = [],
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [levels, setLevels] = useState<{height: number, name: string}[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isTheater, setIsTheater] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(muted);

  // HLS setup
  useEffect(() => {
    if (videoRef.current && Hls.isSupported() && src.endsWith('.m3u8')) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLevels(data.levels.map((l: any, i: number) => ({ height: l.height, name: l.name || `${l.height}p` })));
        setCurrentLevel(hls.currentLevel);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentLevel(data.level);
      });
      return () => {
        hls.destroy();
      };
    }
  }, [src]);

  const handleBuffering = () => setIsBuffering(true);
  const handleCanPlay = () => setIsBuffering(false);
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };
  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.volume = newVolume;
    setVolume(newVolume);
  };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Quality selector
  const handleLevelChange = (levelIdx: number) => {
    if (videoRef.current && Hls.isSupported() && src.endsWith('.m3u8')) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(videoRef.current);
      hls.currentLevel = levelIdx;
      setCurrentLevel(levelIdx);
      setShowSettings(false);
      return () => {
        hls.destroy();
      };
    }
  };

  // Playback speed
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // Subtitles toggle
  useEffect(() => {
    if (videoRef.current) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        videoRef.current.textTracks[i].mode = showSubtitles ? 'showing' : 'hidden';
      }
    }
  }, [showSubtitles]);

  // Play/Pause Button logic
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => setIsPlaying(true));
      }
    }
  };

  // Theater mode overlay
  const theaterOverlay = isTheater ? (
    <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center" onClick={() => setIsTheater(false)} />
  ) : null;

  // Main player container
  return (
    <>
      {theaterOverlay}
      <div className={`relative w-full ${className} ${isFullscreen || isTheater ? 'fixed top-0 left-0 w-screen h-screen z-[1001] bg-black' : ''}`}>
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full h-full object-cover bg-black"
          autoPlay={autoPlay}
          loop={loop}
          muted={isMuted}
          controls={false}
          playsInline
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onError={(e) => {
            const videoElement = e.currentTarget as HTMLVideoElement;
            onError?.(videoElement.error);
            toast.error('Error playing video');
          }}
          onWaiting={() => setIsBuffering(true)}
          onCanPlay={() => setIsBuffering(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          {subtitles.map((track, idx) => (
            <track
              key={track.src + idx}
              src={track.src}
              label={track.label}
              kind="subtitles"
              srcLang={track.lang}
              default={track.default}
            />
          ))}
        </video>
        <button
          onClick={handlePlayPause}
          className="text-white hover:text-blue-500 transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <FullScreenButton
          targetRef={containerRef}
          position="bottom-right"
          onFullScreenChange={setIsFullscreen}
        />
      </div>
    </>
  );
}

export default VideoPlayer; 