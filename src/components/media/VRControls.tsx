import React, { useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaVolumeUp, FaVolumeDown, FaUndo } from 'react-icons/fa';

interface VRControlsProps {
  isVideo?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'a-entity': any;
      'a-plane': any;
      'a-text': any;
    }
  }
}

const VRControls: React.FC<VRControlsProps> = ({
  isVideo = false,
  zoom = 1,
  onZoomChange,
  isPlaying = false,
  onPlayPause,
  volume = 1,
  onVolumeChange
}) => {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!controlsRef.current) return;

    const cleanup = () => {
      const controls = controlsRef.current;
      if (controls) {
        // Remove all child entities
        while (controls.firstChild) {
          const child = controls.firstChild;
          if (child.object3D) {
            child.object3D.traverse((object: any) => {
              if (object.geometry) object.geometry.dispose();
              if (object.material) {
                if (Array.isArray(object.material)) {
                  object.material.forEach((material: any) => material.dispose());
                } else {
                  object.material.dispose();
                }
              }
            });
          }
          controls.removeChild(child);
        }
      }
    };

    return cleanup;
  }, []);

  return (
    <a-entity
      ref={controlsRef}
      position="0 0 -1"
      scale="0.5 0.5 0.5"
      class="vr-controls"
    >
      {/* Play/Pause Button */}
      {isVideo && onPlayPause && (
        <a-entity
          position="-0.5 0.2 0"
          class="clickable"
          onClick={onPlayPause}
        >
          <a-plane
            color="#4A90E2"
            width="0.2"
            height="0.2"
            opacity="0.8"
          />
          <a-text
            value={isPlaying ? "Pause" : "Play"}
            align="center"
            position="0 0 0.01"
            scale="0.5 0.5 0.5"
            color="#FFFFFF"
          />
        </a-entity>
      )}

      {/* Volume Controls */}
      {isVideo && onVolumeChange && (
        <a-entity position="0 0.2 0">
          <a-plane
            color="#4A90E2"
            width="0.2"
            height="0.2"
            opacity="0.8"
            onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
          />
          <a-text
            value={volume === 0 ? "Unmute" : "Mute"}
            align="center"
            position="0 0 0.01"
            scale="0.5 0.5 0.5"
            color="#FFFFFF"
          />
        </a-entity>
      )}

      {/* Reset View Button */}
      <a-entity
        position="0.5 0.2 0"
        class="clickable"
        onClick={() => {
          const camera = document.querySelector('a-camera');
          if (camera) {
            camera.setAttribute('rotation', '0 0 0');
          }
        }}
      >
        <a-plane
          color="#4A90E2"
          width="0.2"
          height="0.2"
          opacity="0.8"
        />
        <a-text
          value="Reset"
          align="center"
          position="0 0 0.01"
          scale="0.5 0.5 0.5"
          color="#FFFFFF"
        />
      </a-entity>

      {/* Zoom Controls */}
      {onZoomChange && (
        <a-entity position="0 -0.2 0">
          <a-plane
            color="#4A90E2"
            width="0.4"
            height="0.2"
            opacity="0.8"
          />
          <a-text
            value={`Zoom: ${zoom.toFixed(1)}x`}
            align="center"
            position="0 0 0.01"
            scale="0.5 0.5 0.5"
            color="#FFFFFF"
          />
          <a-entity
            position="-0.15 0 0.01"
            class="clickable"
            onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}
          >
            <a-text
              value="-"
              align="center"
              scale="0.5 0.5 0.5"
              color="#FFFFFF"
            />
          </a-entity>
          <a-entity
            position="0.15 0 0.01"
            class="clickable"
            onClick={() => onZoomChange(Math.min(2, zoom + 0.1))}
          >
            <a-text
              value="+"
              align="center"
              scale="0.5 0.5 0.5"
              color="#FFFFFF"
            />
          </a-entity>
        </a-entity>
      )}
    </a-entity>
  );
};

export default VRControls;