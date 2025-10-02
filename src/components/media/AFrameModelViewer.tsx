import React, { useEffect } from 'react'

const AFrameModelViewer = ({ src }: { src: string }) => {
  useEffect(() => {
    // Only load A-Frame if not already loaded and we're actually displaying AR content
    if (!document.getElementById('aframe-script') && !(window as any).AFRAME) {
      const script = document.createElement('script');
      script.id = 'aframe-script';
      script.src = 'https://aframe.io/releases/1.4.2/aframe.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);
  return (
    <div className="w-full h-96 rounded-lg overflow-hidden bg-black">
      <a-scene embedded vr-mode-ui="enabled: false">
        <a-entity gltf-model={src} scale="1 1 1" position="0 1.6 -3" />
        <a-sky color="#222" />
        <a-camera wasd-controls-enabled="false" look-controls-enabled="true" />
      </a-scene>
    </div>
  )
}
export default AFrameModelViewer; 