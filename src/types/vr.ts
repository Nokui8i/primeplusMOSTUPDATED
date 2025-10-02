export interface Hotspot {
  /** Unique identifier for the hotspot */
  id: string;
  /** Position in 3D space (x y z) */
  position: string;
  /** Rotation in degrees (x y z) */
  rotation?: string;
  /** Text to display on hover */
  text: string;
  /** URL to navigate to when clicked */
  url?: string;
  /** Custom click handler */
  onClick?: () => void;
  /** Color of the hotspot marker */
  color?: string;
  /** Size of the hotspot marker */
  size?: number;
}

export interface VRControlsProps {
  /** Whether video playback controls should be shown */
  showVideoControls?: boolean;
  /** Whether volume controls should be shown */
  showVolumeControls?: boolean;
  /** Whether zoom controls should be shown */
  showZoomControls?: boolean;
  /** Current zoom level */
  zoom?: number;
  /** Callback when zoom level changes */
  onZoomChange?: (zoom: number) => void;
  /** Callback when video play/pause is toggled */
  onPlayPause?: () => void;
  /** Callback when volume is changed */
  onVolumeChange?: (volume: number) => void;
  /** Whether video is currently playing */
  isPlaying?: boolean;
  /** Current volume level (0-1) */
  volume?: number;
}

export interface VRCursorProps {
  /** Color of the cursor ring. Defaults to white (#FFFFFF) */
  color?: string;
  /** Size of the cursor ring in meters. Defaults to 0.02 */
  size?: number;
} 