import { DetailedHTMLProps, HTMLAttributes } from 'react';

interface AFrameBaseAttributes extends HTMLAttributes<HTMLElement> {
  position?: string;
  rotation?: string;
  scale?: string;
  visible?: boolean;
  class?: string;
  id?: string;
}

interface AFrameEntityAttributes extends AFrameBaseAttributes {
  geometry?: string;
  material?: string;
  text?: string;
  events?: { [key: string]: (() => void) | undefined };
  animation?: string;
  'animation__click'?: string;
  'animation__fusing'?: string;
  'animation__mouseleave'?: string;
  cursor?: string;
  raycaster?: string;
  'look-controls'?: string;
  'wasd-controls'?: string;
  'vr-mode-ui'?: string;
  embedded?: boolean | string;
  webxr?: string;
}

interface AFrameAssetAttributes extends HTMLAttributes<HTMLElement> {
  id?: string;
  src?: string;
  crossOrigin?: string;
  preload?: string;
  responseType?: string;
}

interface AFrameVideoAttributes extends AFrameAssetAttributes {
  autoplay?: boolean;
  loop?: boolean;
  playsInline?: boolean;
}

interface AFrameSceneAttributes extends AFrameBaseAttributes {
  'loading-screen'?: string;
  'vr-mode-ui'?: string;
  webxr?: string;
  cursor?: string;
  raycaster?: string;
  renderer?: string;
  'device-orientation-permission-ui'?: string;
  embedded?: boolean | string;
  onEnterVR?: () => void;
  onExitVR?: () => void;
}

interface AFrameSkyAttributes extends AFrameBaseAttributes {
  src?: string;
  color?: string;
  radius?: string;
}

interface AFrameTextAttributes extends AFrameBaseAttributes {
  value?: string;
  align?: 'left' | 'center' | 'right';
  baseline?: 'top' | 'center' | 'bottom';
  color?: string;
  font?: string;
  fontImage?: string;
  height?: number;
  letterSpacing?: number;
  lineHeight?: number;
  opacity?: number;
  shader?: string;
  side?: 'front' | 'back' | 'double';
  tabSize?: number;
  width?: number;
  wrapCount?: number;
  wrapPixels?: number;
  zOffset?: number;
}

interface AFrameCircleAttributes extends AFrameBaseAttributes {
  radius?: string | number;
  segments?: number;
  thetaStart?: number;
  thetaLength?: number;
  material?: string;
  color?: string;
}

interface AFrameCameraAttributes extends AFrameBaseAttributes {
  active?: boolean;
  far?: number;
  fov?: number;
  'look-controls-enabled'?: boolean;
  near?: number;
  'reverse-mouse-drag'?: boolean;
  'wasd-controls-enabled'?: boolean;
  zoom?: number;
}

declare global {
  interface Window {
    AFRAME: any;
  }
  namespace JSX {
    interface IntrinsicElements {
      'a-scene': any;
      'a-entity': any;
      'a-camera': any;
      'a-sky': any;
      'a-assets': any;
      'a-text': any;
      'a-plane': any;
      video: DetailedHTMLProps<AFrameVideoAttributes & HTMLVideoElement, HTMLVideoElement>;
      img: DetailedHTMLProps<AFrameAssetAttributes & HTMLImageElement, HTMLImageElement>;
    }
  }
}

declare module 'aframe' {
  export interface Entity {
    getAttribute(attr: string): any;
    setAttribute(attr: string, value: any): void;
    components: {
      [key: string]: {
        material?: {
          material?: {
            map?: {
              image?: HTMLImageElement | HTMLVideoElement;
            };
          };
        };
      };
    };
  }
}

export interface AFrameScene extends HTMLElement {
  is: (mode: string) => boolean;
  enterVR: () => Promise<void>;
  exitVR: () => Promise<void>;
}

export interface AFrameCamera extends HTMLElement {
  components: {
    camera: {
      zoom: number;
      updateProjectionMatrix: () => void;
    };
  };
}

export interface AFrameEntity extends HTMLElement {
  object3D: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  };
  components: {
    material: {
      material: {
        opacity: number;
        color: string;
      };
    };
  };
} 