import React, { useEffect, useRef } from 'react';
import { AFrameEntity } from '@/types/aframe';

interface VRCursorProps {
  color?: string;
  size?: number;
}

const VRCursor: React.FC<VRCursorProps> = ({ color = '#FFFFFF', size = 0.02 }) => {
  const cursorRef = useRef<AFrameEntity>(null);

  useEffect(() => {
    const camera = document.querySelector('a-camera');
    if (camera && cursorRef.current) {
      camera.appendChild(cursorRef.current);
    }

    return () => {
      if (cursorRef.current) {
        cursorRef.current.parentNode?.removeChild(cursorRef.current);
      }
    };
  }, []);

  return (
    <a-entity
      ref={cursorRef}
      cursor="rayOrigin: mouse; fuse: true; fuseTimeout: 1500"
      position="0 0 -1"
      geometry={`primitive: ring; radiusInner: ${size}; radiusOuter: ${size * 1.2}`}
      material={`color: ${color}; shader: flat; opacity: 0.8`}
      raycaster="objects: .clickable"
      animation__click="property: scale; startEvents: click; easing: easeInCubic; dur: 150; from: 0.1 0.1 0.1; to: 1 1 1"
      animation__fusing="property: scale; startEvents: fusing; easing: easeInCubic; dur: 1500; from: 1 1 1; to: 0.1 0.1 0.1"
      animation__mouseleave="property: scale; startEvents: mouseleave; easing: easeInCubic; dur: 150; to: 1 1 1"
    />
  );
};

export default VRCursor;