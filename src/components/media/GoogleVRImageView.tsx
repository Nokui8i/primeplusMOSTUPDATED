'use client';

import { useEffect, useRef, useState, forwardRef } from 'react';
import GoogleVRView from './GoogleVRView';

interface Hotspot {
  id: string;
  pitch: number; // In degrees. Up is positive.
  yaw: number; // In degrees. To the right is positive.
  radius?: number; // Radius of the circular target in meters.
  distance?: number; // Distance of target from camera in meters.
}

interface QualityOption {
  label: string;
  file: string;
}

interface GoogleVRImageViewProps {
  src: string;
  width?: string;
  height?: string;
  preview?: string;
  isStereo?: boolean;
  isDebug?: boolean;
  isVROff?: boolean;
  isAutopanOff?: boolean;
  defaultYaw?: number;
  isYawOnly?: boolean;
  className?: string;
  hotspots?: Hotspot[];
  qualities?: QualityOption[];
  onReady?: () => void;
  onError?: (error: any) => void;
  onModeChange?: (mode: string) => void;
  onHotspotClick?: (hotspotId: string) => void;
}

const GoogleVRImageView = forwardRef<any, GoogleVRImageViewProps>(({
  src,
  width = '100%',
  height = '400px',
  preview,
  isStereo = false,
  isDebug = false,
  isVROff = false,
  isAutopanOff = false,
  defaultYaw,
  isYawOnly = false,
  className = '',
  hotspots = [],
  qualities,
  onReady,
  onError,
  onModeChange,
  onHotspotClick
}, ref) => {
  const vrViewRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  const handleReady = () => {
    setIsReady(true);
    onReady?.();
  };

  const handleHotspotClick = (hotspotId: string) => {
    onHotspotClick?.(hotspotId);
  };

  // Add hotspots when VR View is ready
  useEffect(() => {
    if (isReady && vrViewRef.current && hotspots.length > 0) {
      hotspots.forEach((hotspot) => {
        vrViewRef.current.addHotspot(hotspot.id, {
          pitch: hotspot.pitch,
          yaw: hotspot.yaw,
          radius: hotspot.radius || 0.05,
          distance: hotspot.distance || 2
        });
      });
    }
  }, [isReady, hotspots]);

  return (
    <GoogleVRView
      src={src}
      type="image"
      width={width}
      height={height}
      preview={preview}
      isStereo={isStereo}
      onReady={handleReady}
      onError={onError}
      onHotspotClick={handleHotspotClick}
    />
  );
});

GoogleVRImageView.displayName = 'GoogleVRImageView';

export default GoogleVRImageView;
