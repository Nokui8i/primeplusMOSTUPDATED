'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

interface QualityOption {
  label: string;
  file: string;
}

interface GoogleVRViewProps {
  src: string;
  type: 'image' | 'video' | 'image360' | 'video360' | 'vr' | 'ar';
  width?: string;
  height?: string;
  isStereo?: boolean;
  preview?: string;
  isDebug?: boolean;
  isVROff?: boolean;
  isAutopanOff?: boolean;
  defaultYaw?: number;
  isYawOnly?: boolean;
  className?: string;
  qualities?: QualityOption[];
  onReady?: () => void;
  onError?: (error: any) => void;
  onModeChange?: (mode: string) => void;
  onHotspotClick?: (hotspotId: string) => void;
}

declare global {
  interface Window {
    VRView: any;
  }
}

const GoogleVRView = forwardRef<any, GoogleVRViewProps>(({
  src,
  type,
  width = '100%',
  height = '400px',
  isStereo = false,
  preview,
  isDebug = false,
  isVROff = false,
  isAutopanOff = false,
  defaultYaw,
  isYawOnly = false,
  className = '',
  qualities,
  onReady,
  onError,
  onModeChange,
  onHotspotClick
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const vrViewRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vrFailed, setVrFailed] = useState(false);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string>(qualities?.[0]?.file || src);

  useEffect(() => {
    if (!containerRef.current) return;

    async function loadVR() {
      let url = selectedQuality;

      // Handle different URL types
      if (url.startsWith('blob:')) {
        // Convert blob URL to data URL for preview
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            setFinalUrl(dataUrl);
            if (!vrFailed) {
              createVRViewIframe(dataUrl);
            }
          };
          reader.readAsDataURL(blob);
        } catch (error) {
          console.error('Error converting blob to data URL:', error);
          setVrFailed(true);
          return;
        }
      } else if (url.includes('cloudfront.net') || url.includes('s3.amazonaws.com') || url.includes('s3.us-east-1.amazonaws.com')) {
        // For CloudFront or S3 URLs, use our proxy to serve the content
        try {
          const { extractS3KeyFromUrl } = await import('@/lib/aws/s3');
          let s3Key;
          
          if (url.includes('cloudfront.net')) {
            s3Key = extractS3KeyFromUrl(url);
          } else {
            // Extract S3 key from direct S3 URL
            const urlParts = url.split('/');
            s3Key = urlParts.slice(3).join('/'); // Remove https://bucket.s3.region.amazonaws.com/
          }
          
          // Use our proxy endpoint instead of signed URLs
          const proxyUrl = `/api/vr-proxy?key=${encodeURIComponent(s3Key)}`;
          const fullProxyUrl = `${window.location.origin}${proxyUrl}`;
          setFinalUrl(fullProxyUrl);
          if (!vrFailed) {
            createVRViewIframe(fullProxyUrl);
          }
        } catch (error) {
          console.error('❌ Error processing S3 URL:', error);
          setVrFailed(true);
          return;
        }
      } else {
        // Create iframe for other URLs (data URLs, etc.)
        setFinalUrl(url);
        if (!vrFailed) {
          createVRViewIframe(url);
        }
      }
    }

    loadVR();

    return () => {
      // Cleanup
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [selectedQuality, type, width, height, isStereo, preview, isDebug, isVROff, isAutopanOff, defaultYaw, isYawOnly]);

  // Function to create the VR View iframe
  const createVRViewIframe = (sourceUrl: string) => {
    if (!containerRef.current) return;

    // Check if this is a localhost URL or our proxy URL - if so, use A-Frame instead of Google VR View
    if (sourceUrl.includes('localhost') || sourceUrl.includes('127.0.0.1') || sourceUrl.includes('/api/vr-proxy')) {
      createAFrameView(sourceUrl);
      return;
    }

    const iframe = document.createElement('iframe');
    const params = new URLSearchParams();
    
    if (type === 'image') {
      params.set('image', sourceUrl);
    } else {
      params.set('video', sourceUrl);
    }
    
    if (preview) params.set('preview', preview);
    if (isStereo) params.set('is_stereo', 'true');
    if (isDebug) params.set('is_debug', 'true');
    if (isVROff) params.set('is_vr_off', 'true');
    if (isAutopanOff) params.set('is_autopan_off', 'true');
    if (defaultYaw) params.set('default_yaw', defaultYaw.toString());
    if (isYawOnly) params.set('is_yaw_only', 'true');

    const vrViewUrl = `https://storage.googleapis.com/vrview/2.0/embed?${params.toString()}`;
    
    iframe.src = vrViewUrl;
    iframe.width = '100%';
    iframe.height = height;
    iframe.frameBorder = '0';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    
    // Clear container and add iframe
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(iframe);
    
    // Set loaded state
    setIsLoaded(true);
    onReady?.();

    // Handle iframe load
    iframe.onload = () => {
      setIsLoaded(true);
      onReady?.();
    };

    iframe.onerror = () => {
      const errorMsg = 'Failed to load VR content';
      setError(errorMsg);
      setVrFailed(true);
      onError?.(new Error(errorMsg));
    };
  };

  // Function to create A-Frame VR view for localhost URLs
  const createAFrameView = (sourceUrl: string) => {
    if (!containerRef.current) return;

    const aFrameHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          a-scene { width: 100%; height: 100vh; }
        </style>
      </head>
      <body>
        <a-scene embedded vr-mode-ui="enabled: false">
          <a-sky src="${sourceUrl}" rotation="0 -90 0"></a-sky>
          <a-camera position="0 1.6 0" look-controls="reverseMouseDrag: true"></a-camera>
        </a-scene>
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.srcdoc = aFrameHTML;
    iframe.width = '100%';
    iframe.height = height;
    iframe.frameBorder = '0';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    
    // Clear container and add iframe
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(iframe);
    
    // Set loaded state
    setIsLoaded(true);
    onReady?.();

    // Handle iframe load
    iframe.onload = () => {
      setIsLoaded(true);
      onReady?.();
    };

    iframe.onerror = () => {
      const errorMsg = 'Failed to load A-Frame VR content';
      setError(errorMsg);
      setVrFailed(true);
      onError?.(new Error(errorMsg));
    };
  };

  // Video control methods (iframe-based, limited control)
  const play = () => {
    // Note: Limited control with iframe approach
    console.log('Play requested - iframe approach has limited control');
  };

  const pause = () => {
    // Note: Limited control with iframe approach
    console.log('Pause requested - iframe approach has limited control');
  };

  const setVolume = (volume: number) => {
    // Note: Limited control with iframe approach
    console.log(`Volume set to ${volume} - iframe approach has limited control`);
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    play,
    pause,
    setVolume,
    vrView: null // No direct VRView instance with iframe approach
  }), [isLoaded]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`} style={{ width, height }}>
        <div className="text-center">
          <p className="text-red-600 mb-2">Failed to load VR content</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height: type === 'video' && qualities ? '550px' : height }}>
      {!vrFailed ? (
        <div 
          ref={containerRef}
          style={{ width, height: type === 'video' && qualities ? '500px' : height }}
          className="rounded-lg overflow-hidden"
        />
      ) : (
        // Fallback to regular HTML5 video/image
        finalUrl && (
          (type === 'video' || type === 'video360') ? (
            <video
              src={finalUrl}
              controls
              className="w-full h-full object-contain rounded-lg"
              style={{ height: (type === 'video360') && qualities ? '500px' : height }}
            />
          ) : (
            <img
              src={finalUrl}
              alt="Panoramic"
              className="w-full h-full object-contain rounded-lg"
              style={{ height: (type === 'image360') && qualities ? '500px' : height }}
            />
          )
        )
      )}
      
      {!isLoaded && !vrFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading VR content...</p>
          </div>
        </div>
      )}

      {/* Quality selector for videos */}
      {type === 'video' && qualities && qualities.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 flex gap-2 p-2 justify-center bg-gray-900/80 backdrop-blur-sm text-white rounded-b-lg">
          {qualities.map((quality) => (
            <button
              key={quality.label}
              onClick={() => setSelectedQuality(quality.file)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedQuality === quality.file 
                  ? "bg-blue-500 text-white" 
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {quality.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

GoogleVRView.displayName = 'GoogleVRView';

export default GoogleVRView;
