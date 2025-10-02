import React, { useEffect, useRef, useState } from 'react';

interface Hotspot {
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  text?: string;
  onClick?: () => void;
}

interface ModernAFrameImage360Props {
  src: string;
  hotspots?: Hotspot[];
  onClose: () => void;
}

const ModernAFrameImage360: React.FC<ModernAFrameImage360Props> = ({ src, hotspots = [], onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [sceneId] = useState(() => `modern-aframe-scene-${Math.random().toString(36).slice(2)}`);
  const [isAFrameReady, setIsAFrameReady] = useState(false);
  const sceneRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load A-Frame script
  useEffect(() => {
    if ((window as any).AFRAME) {
      setIsAFrameReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://aframe.io/releases/1.4.2/aframe.min.js';
    script.async = true;
    script.onload = () => setIsAFrameReady(true);
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Setup scene
  useEffect(() => {
    if (!isAFrameReady || !containerRef.current) return;

    const cleanup = () => {
      if (sceneRef.current) {
        // Remove event listeners from hotspots
        const hotspotElements = sceneRef.current.querySelectorAll('.hotspot');
        hotspotElements.forEach(hotspot => {
          const clone = hotspot.cloneNode(true);
          hotspot.parentNode?.replaceChild(clone, hotspot);
        });

        // Force WebGL context loss
        const scene = sceneRef.current as any;
        if (scene.renderer?.forceContextLoss) {
          scene.renderer.forceContextLoss();
        }

        // Remove scene from DOM safely
        const container = containerRef.current;
        if (sceneRef.current.parentNode === container && container) {
          container.removeChild(sceneRef.current);
        }
        sceneRef.current = null;
      }
    };

    // Clean up any existing scene
    cleanup();

    const container = containerRef.current;
    if (!container) return;

    // Create new scene
    const scene = document.createElement('a-scene');
    scene.setAttribute('embedded', '');
    scene.setAttribute('loading-screen', 'enabled: false');
    scene.setAttribute('renderer', 'antialias: true; colorManagement: true; sortObjects: true');
    scene.setAttribute('background', 'color: #000');
    scene.id = sceneId;
    sceneRef.current = scene;

    // Setup scene elements
    const assets = document.createElement('a-assets');
    const img = document.createElement('img');
    img.id = `img-${sceneId}`;
    img.src = src;
    img.setAttribute('crossorigin', 'anonymous');
    assets.appendChild(img);

    const camera = document.createElement('a-entity');
    camera.setAttribute('position', '0 0 0');
    camera.setAttribute('camera', '');
    camera.setAttribute('look-controls', '');
    camera.setAttribute('wasd-controls', 'enabled: false');

    const sky = document.createElement('a-sky');
    sky.setAttribute('src', `#img-${sceneId}`);
    sky.setAttribute('rotation', '0 -90 0');

    // Handle image loading
    img.onload = () => {
      setIsLoading(false);
      scene.appendChild(sky);
    };

    img.onerror = () => {
      setIsLoading(false);
      console.error('Failed to load 360° image');
    };

    // Add hotspots
    hotspots.forEach((hotspot, index) => {
      const entity = document.createElement('a-entity');
      entity.className = 'hotspot';
      entity.setAttribute('position', `${hotspot.position.x} ${hotspot.position.y} ${hotspot.position.z}`);
      if (hotspot.rotation) {
        entity.setAttribute('rotation', `${hotspot.rotation.x} ${hotspot.rotation.y} ${hotspot.rotation.z}`);
      }
      entity.setAttribute('geometry', 'primitive: circle; radius: 0.1');
      entity.setAttribute('material', 'color: #4A90E2; opacity: 0.8');
      
      const text = hotspot.text?.trim() || `Hotspot ${index + 1}`;
      entity.setAttribute('text', `value: ${text}; align: center; width: 1; color: white`);
      
      if (hotspot.onClick) {
        const handler = (e: Event) => {
          e.stopPropagation();
          hotspot.onClick?.();
        };
        entity.addEventListener('click', handler);
      }
      
      scene.appendChild(entity);
    });

    // Add elements to scene
    scene.appendChild(assets);
    scene.appendChild(camera);
    container.appendChild(scene);

    return cleanup;
  }, [isAFrameReady, src, hotspots, sceneId]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
    >
      <button
        onClick={onClose}
        className="absolute top-8 right-8 z-50 bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
      >
        Close
      </button>
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-40">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white" />
        </div>
      )}
      
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded-full">
        Use mouse to look around • Click and drag to rotate
      </div>
    </div>
  );
};

export default ModernAFrameImage360; 