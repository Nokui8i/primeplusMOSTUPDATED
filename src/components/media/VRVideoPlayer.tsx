import React, { useLayoutEffect, useRef, useState, useCallback, useEffect } from 'react';
import { FaVrCardboard, FaExpand, FaCompress, FaUndo, FaPlay, FaPause, FaVolumeDown, FaVolumeUp, FaCog, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import * as THREE from 'three';
import { Hotspot } from '@/types/vr';
import { ContentWatermark } from './ContentWatermark';
import { SmoothTimeline } from '@/components/ui/SmoothTimeline';
import '@/styles/slider.css';

interface VRVideoPlayerProps {
  src: string;
  projection?: '360' | '180' | 'equirectangular';
  quality?: 'auto' | 'high' | 'medium' | 'low';
  autoplay?: boolean;
  muted?: boolean;
  poster?: string;
  width?: string;
  height?: string;
  hotspots?: Hotspot[];
  onHotspotClick?: (hotspotId: string) => void;
  onError?: (error: string) => void;
  username?: string;
  showWatermark?: boolean;
}

const VRVideoPlayer: React.FC<VRVideoPlayerProps> = ({
  src,
  projection = '360',
  quality = 'auto',
  autoplay = false,
  muted = false,
  poster,
  width = '100%',
  height = '400px',
  hotspots = [],
  onHotspotClick,
  onError,
  username,
  showWatermark = true
}) => {
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(muted ? 0 : 1);
  const [isVRMode, setIsVRMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isVRSupported, setIsVRSupported] = useState(false);
  const [vrDevice, setVrDevice] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    onError?.(errorMessage);
    toast.error(errorMessage);
  }, [onError]);

  // VR Headset Detection
  const checkVRSupport = useCallback(async () => {
    try {
      // Check for WebXR support
      if ('xr' in navigator) {
        const isSupported = await (navigator as any).xr.isSessionSupported('immersive-vr');
        if (isSupported) {
          setIsVRSupported(true);
          return true;
        }
      }

      // Check for WebVR support (legacy)
      if ('getVRDisplays' in navigator) {
        const displays = await (navigator as any).getVRDisplays();
        if (displays.length > 0) {
          setVrDevice(displays[0]);
          setIsVRSupported(true);
          return true;
        }
      }

      // Check for Cardboard VR (mobile)
      if (window.DeviceOrientationEvent && 'requestPermission' in window.DeviceOrientationEvent) {
        setIsVRSupported(true);
        return true;
      }

      setIsVRSupported(true); // Show button even without headset for testing
      return false;
    } catch (error) {
      console.warn('⚠️ [VR_DEBUG] VR detection failed:', error);
      setIsVRSupported(false);
      return false;
    }
  }, []);

  const initializeThreeJS = useCallback(() => {
    if (!containerRef.current || !videoRef.current) return;

    // Check if Three.js already initialized
    if (rendererRef.current) {
      return;
    }


    try {
      // Create scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
      cameraRef.current = camera;

      // Create renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      
      // Set canvas z-index to be below watermark
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.top = '0';
      renderer.domElement.style.left = '0';
      renderer.domElement.style.zIndex = '1';
      
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Create video texture
      const videoTexture = new THREE.VideoTexture(videoRef.current);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.format = THREE.RGBAFormat;

      // Create sphere geometry for 360° video
      const geometry = new THREE.SphereGeometry(500, 60, 40);
      
      // Invert the geometry so it's inside-out
      geometry.scale(-1, 1, 1);

      // Create material with video texture
      const material = new THREE.MeshBasicMaterial({ map: videoTexture });
      
      // Create sphere mesh
      const sphere = new THREE.Mesh(geometry, material);
      scene.add(sphere);
      sphereRef.current = sphere;

      // Add hotspots to the scene
      hotspots.forEach((hotspot) => {
        // Create a more visible hotspot for room navigation
        const hotspotGeometry = new THREE.SphereGeometry(hotspot.size || 0.3, 16, 16);
        const hotspotMaterial = new THREE.MeshBasicMaterial({ 
          color: hotspot.color || '#4A90E2',
          transparent: true,
          opacity: 0.9
        });
        const hotspotMesh = new THREE.Mesh(hotspotGeometry, hotspotMaterial);
        
        // Parse position string "x y z" to Vector3
        const [x, y, z] = hotspot.position.split(' ').map(Number);
        hotspotMesh.position.set(x, y, z);
        
        // Add pulsing animation
        const pulseGeometry = new THREE.SphereGeometry((hotspot.size || 0.3) * 1.5, 16, 16);
        const pulseMaterial = new THREE.MeshBasicMaterial({ 
          color: hotspot.color || '#4A90E2',
          transparent: true,
          opacity: 0.3
        });
        const pulseMesh = new THREE.Mesh(pulseGeometry, pulseMaterial);
        pulseMesh.position.set(x, y, z);
        
        // Make hotspot clickable
        hotspotMesh.userData = { hotspotId: hotspot.id, isHotspot: true };
        pulseMesh.userData = { hotspotId: hotspot.id, isHotspot: true };
        
        scene.add(hotspotMesh);
        scene.add(pulseMesh);
        
        // Add pulsing animation
        const animatePulse = () => {
          const time = Date.now() * 0.001;
          pulseMesh.scale.setScalar(1 + Math.sin(time * 2) * 0.2);
          pulseMaterial.opacity = 0.3 + Math.sin(time * 2) * 0.2;
        };
        
        // Store animation function for cleanup
        (hotspotMesh as any).animatePulse = animatePulse;
        (pulseMesh as any).animatePulse = animatePulse;
      });

      // Position camera inside sphere
      camera.position.set(0, 0, 0);

      // Mouse controls for desktop
      let isMouseDown = false;
      let mouseX = 0;
      let mouseY = 0;
      let targetRotationX = 0;
      let targetRotationY = 0;

      const onMouseDown = (event: MouseEvent) => {
        // Check for hotspot clicks first
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        const intersects = raycaster.intersectObjects(scene.children);
        const hotspot = intersects.find(intersect => intersect.object.userData.isHotspot);
        
        if (hotspot) {
          onHotspotClick?.(hotspot.object.userData.hotspotId);
          return;
        }
        
        isMouseDown = true;
        mouseX = event.clientX;
        mouseY = event.clientY;
      };

      const onMouseMove = (event: MouseEvent) => {
        if (!isMouseDown) return;

        const deltaX = event.clientX - mouseX;
        const deltaY = event.clientY - mouseY;

        targetRotationY += deltaX * 0.01;
        targetRotationX += deltaY * 0.01;

        // Limit vertical rotation
        targetRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotationX));

        mouseX = event.clientX;
        mouseY = event.clientY;
      };

      const onMouseUp = () => {
        isMouseDown = false;
      };

      const onWheel = (event: WheelEvent) => {
        camera.fov += event.deltaY * 0.01;
        camera.fov = Math.max(10, Math.min(120, camera.fov));
        camera.updateProjectionMatrix();
      };

      // Touch controls for mobile
      let touchStart = { x: 0, y: 0 };
      let isTouching = false;

      const onTouchStart = (event: TouchEvent) => {
        if (event.touches.length === 1) {
          isTouching = true;
          touchStart.x = event.touches[0].clientX;
          touchStart.y = event.touches[0].clientY;
        }
      };

      const onTouchMove = (event: TouchEvent) => {
        if (!isTouching || event.touches.length !== 1) return;
        
        event.preventDefault(); // Prevent scrolling
        
        const deltaX = event.touches[0].clientX - touchStart.x;
        const deltaY = event.touches[0].clientY - touchStart.y;

        targetRotationY += deltaX * 0.01;
        targetRotationX += deltaY * 0.01;

        // Limit vertical rotation
        targetRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotationX));

        touchStart.x = event.touches[0].clientX;
        touchStart.y = event.touches[0].clientY;
      };

      const onTouchEnd = () => {
        isTouching = false;
      };

      // Add event listeners
      renderer.domElement.addEventListener('mousedown', onMouseDown);
      renderer.domElement.addEventListener('mousemove', onMouseMove);
      renderer.domElement.addEventListener('mouseup', onMouseUp);
      renderer.domElement.addEventListener('wheel', onWheel);
      renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
      renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
      renderer.domElement.addEventListener('touchend', onTouchEnd);

      // Animation loop
      const animate = () => {
        animationRef.current = requestAnimationFrame(animate);

        if (sphereRef.current) {
          // Smooth rotation
          sphereRef.current.rotation.y += (targetRotationY - sphereRef.current.rotation.y) * 0.1;
          sphereRef.current.rotation.x += (targetRotationX - sphereRef.current.rotation.x) * 0.1;
        }

        // Animate hotspots
        scene.children.forEach((child) => {
          if (child.userData.isHotspot && (child as any).animatePulse) {
            (child as any).animatePulse();
          }
        });

        renderer.render(scene, camera);
      };

      animate();

      setIsLoaded(true);

    } catch (err: any) {
      console.error('❌ [VR_DEBUG] Failed to initialize Three.js VR player:', err);
      handleError('Failed to initialize VR player');
    }
  }, [handleError]);

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (rendererRef.current && containerRef.current) {
      containerRef.current.removeChild(rendererRef.current.domElement);
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    if (sceneRef.current) {
      sceneRef.current.clear();
      sceneRef.current = null;
    }

    if (cameraRef.current) {
      cameraRef.current = null;
    }

    if (sphereRef.current) {
      sphereRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    // Check if video already exists
    if (videoRef.current) {
      return;
    }


    // Create video element
    const video = document.createElement('video');
    video.src = src;
    video.crossOrigin = 'anonymous';
    video.muted = muted;
    // Do not loop VR videos by default
    video.loop = false;
    video.playsInline = true;
    
    // Add mobile attributes for fullscreen support
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('playsinline', 'true');
    video.setAttribute('x5-video-player-type', 'h5');
    video.setAttribute('x5-video-player-fullscreen', 'true');
    video.setAttribute('x5-video-orientation', 'landscape');
    
    // Make video visible but hidden behind canvas for fullscreen
    video.style.position = 'absolute';
    video.style.opacity = '0';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.zIndex = '1';
    
    if (poster) {
      video.poster = poster;
      // Ensure poster shows until play starts
      video.preload = 'metadata';
    }
    
            (videoRef as any).current = video;
    containerRef.current.appendChild(video);

    // Video event listeners
    video.addEventListener('loadedmetadata', () => {
      initializeThreeJS();
    });

    video.addEventListener('canplay', () => {
      if (autoplay) {
        video.play();
        setIsPlaying(true);
      }
    });

    video.addEventListener('error', (e) => {
      console.error('❌ [VR_DEBUG] Video error:', e);
      handleError('Video failed to load');
    });

    video.addEventListener('waiting', () => {
    });

    video.addEventListener('playing', () => {
      setIsPlaying(true);
    });

    video.addEventListener('pause', () => {
      setIsPlaying(false);
    });

    // When video ends, mark as not playing and ensure any rAF loop stops
    video.addEventListener('ended', () => {
      setIsPlaying(false);
    });

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    // Load video
    video.load();

    return () => {
      cleanup();
      if (video && video.parentNode) {
        video.parentNode.removeChild(video);
      }
    };
  }, [src]); // Only depend on src

  useEffect(() => {
    const handleResize = () => {
      if (rendererRef.current && cameraRef.current && containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!(document.fullscreenElement || 
                               (document as any).webkitFullscreenElement || 
                               (document as any).mozFullScreenElement || 
                               (document as any).msFullscreenElement);
      setIsFullscreen(isFullscreen);
      
      // Resize renderer when fullscreen changes
      setTimeout(() => {
        if (rendererRef.current && cameraRef.current && containerRef.current) {
          const width = containerRef.current.clientWidth;
          const height = containerRef.current.clientHeight;
          
          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(width, height);
        }
      }, 100);
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

  // Check VR support on mount
  useEffect(() => {
    checkVRSupport();
  }, [checkVRSupport]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r' && isLoaded) {
        if (cameraRef.current) {
          cameraRef.current.rotation.set(0, 0, 0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isLoaded]);

  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
    }
  }, []);

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

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  // Ensure timeline updates are working with smooth animation
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
  }, [isLoaded]);

  // Fallback: Set default duration if not loaded
  useEffect(() => {
    if (isPlaying && duration === 0) {
      setDuration(120); // Default 2 minute duration
    }
  }, [isPlaying, duration]);

  const toggleFullscreen = useCallback(() => {
    const isFullscreen = document.fullscreenElement || 
                        (document as any).webkitFullscreenElement || 
                        (document as any).mozFullScreenElement || 
                        (document as any).msFullscreenElement;
    
    if (!isFullscreen) {
      // Always use container for fullscreen to maintain Three.js 360° rendering
      // Do NOT use video element as it shows flat 2D video
      const containerEl = containerRef.current as any;
      
      if (!containerEl) return;
      
      if (containerEl.requestFullscreen) {
        containerEl.requestFullscreen().catch((err: any) => {
          console.error('Error entering fullscreen on container:', err);
        });
      } else if (containerEl.webkitRequestFullscreen) {
        containerEl.webkitRequestFullscreen();
      } else if (containerEl.mozRequestFullScreen) {
        containerEl.mozRequestFullScreen();
      } else if (containerEl.msRequestFullscreen) {
        containerEl.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  }, []);

  const resetView = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.rotation.set(0, 0, 0);
    }
  }, []);

  const enterVRMode = useCallback(async () => {
    if (!isVRSupported) {
      toast.error('VR not supported on this device');
      return;
    }

    try {
      // Check if we have actual VR support
      const hasRealVR = ('xr' in navigator) || ('getVRDisplays' in navigator) || 
                       (window.DeviceOrientationEvent && 'requestPermission' in window.DeviceOrientationEvent);
      
      if (!hasRealVR) {
        toast.error('No VR headset detected. Please connect a VR headset or enable WebXR in Chrome flags.');
        return;
      }
      // WebXR VR Mode
      if ('xr' in navigator) {
        const session = await (navigator as any).xr.requestSession('immersive-vr');
        setIsVRMode(true);
        
        // Handle VR session end
        session.addEventListener('end', () => {
          setIsVRMode(false);
        });
      }
      // WebVR Mode (legacy)
      else if (vrDevice) {
        await vrDevice.requestPresent([{ source: rendererRef.current?.domElement }]);
        setIsVRMode(true);
        
        // Handle VR session end
        vrDevice.addEventListener('vrdisplaypresentchange', () => {
          if (!vrDevice.isPresenting) {
            setIsVRMode(false);
          }
        });
      }
      // Cardboard VR Mode (mobile)
      else {
        // Request device orientation permission
        if (window.DeviceOrientationEvent && 'requestPermission' in window.DeviceOrientationEvent) {
          const permission = await (window.DeviceOrientationEvent as any).requestPermission();
          if (permission === 'granted') {
            setIsVRMode(true);
          }
        }
      }
    } catch (error) {
      console.error('❌ [VR_DEBUG] Failed to enter VR mode:', error);
      toast.error('Failed to enter VR mode');
    }
  }, [isVRSupported, vrDevice]);

  const exitVRMode = useCallback(() => {
    if (vrDevice && vrDevice.exitPresent) {
      vrDevice.exitPresent();
    }
    setIsVRMode(false);
  }, [vrDevice]);

  if (error) {
    return (
      <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden flex items-center justify-center" style={{ width, height }}>
        <div className="text-center text-white">
          <FaSpinner className="mx-auto mb-4 text-4xl text-red-500" />
          <h3 className="text-xl font-semibold mb-2">Video Error</h3>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black rounded-2xl overflow-hidden"
      style={{ width, height }}
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Watermark - shows in both normal and fullscreen modes */}
      {username && showWatermark && <ContentWatermark username={username} />}
      {/* Loading state */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          {poster ? (
            <div className="relative w-full h-full">
              <img
                src={poster}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to loading spinner if poster fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center text-white">
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.play();
                        setIsPlaying(true);
                      }
                    }}
                    className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 hover:bg-white/30 transition-colors"
                  >
                    <FaPlay className="text-3xl text-white ml-1" />
                  </button>
                  <h3 className="text-xl font-semibold mb-2">360° Video</h3>
                  <p className="text-gray-300 mb-2">Click to play</p>
                  {isVRSupported && (
                    <div className="mt-2 flex items-center justify-center space-x-2">
                      <FaVrCardboard className="text-green-400" />
                      <span className="text-green-400 text-sm">VR Headset Detected</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-white">
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.play();
                    setIsPlaying(true);
                  }
                }}
                className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 hover:bg-white/30 transition-colors"
              >
                <FaPlay className="text-3xl text-white ml-1" />
              </button>
              <h3 className="text-xl font-semibold mb-2">360° Video</h3>
              <p className="text-gray-300 mb-2">Click to play</p>
              {isVRSupported && (
                <div className="mt-2 flex items-center justify-center space-x-2">
                  <FaVrCardboard className="text-green-400" />
                  <span className="text-green-400 text-sm">VR Headset Detected</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* Custom Controls */}
      {isLoaded && showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 z-20">
          {/* Timeline */}
          <div className="mb-4">
            <SmoothTimeline
              currentTime={currentTime}
              duration={duration}
              onSeek={seekTo}
            />
          </div>
          
          {/* Controls */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button onClick={togglePlayPause} className="text-white text-xl">
                {isPlaying ? <FaPause /> : <FaPlay />}
              </button>
              <div className="flex items-center space-x-2">
                <FaVolumeDown className="text-white" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-24"
                />
                <FaVolumeUp className="text-white" />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={resetView} 
                className="text-white text-xl hover:text-blue-400 transition-colors"
              >
                <FaUndo />
              </button>
              {isVRSupported && (
                <button 
                  onClick={isVRMode ? exitVRMode : enterVRMode} 
                  className={`text-xl ${isVRMode ? 'text-blue-400' : 'text-white'}`}
                  title={isVRMode ? 'Exit VR Mode' : 'Enter VR Mode'}
                >
                  <FaVrCardboard />
                </button>
              )}
              <button onClick={toggleFullscreen} className="text-white text-xl">
                {isFullscreen ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VRVideoPlayer;