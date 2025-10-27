'use client'

import React, { useEffect, useRef, useState } from 'react'
import { extractS3KeyFromUrl } from '@/lib/aws/s3'

interface GoogleVRViewProps {
  src: string
  type: 'image' | 'video' | 'image360' | 'video360' | 'vr' | 'ar'
  width?: string
  height?: string
  preview?: string
  isStereo?: boolean
  onReady?: () => void
  onError?: (error: string) => void
  hotspots?: Array<{
    id: string
    pitch: number
    yaw: number
    text: string
  }>
  onHotspotClick?: (hotspotId: string) => void
}

export const GoogleVRView: React.FC<GoogleVRViewProps> = ({
  src,
  type,
  width = '100%',
  height = '400px',
  preview,
  isStereo = false,
  onReady,
  onError,
  hotspots = [],
  onHotspotClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [finalUrl, setFinalUrl] = useState(src)
  const [vrFailed, setVrFailed] = useState(false)
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  const [showAFrame, setShowAFrame] = useState(false)
  const [aFrameHTML, setAFrameHTML] = useState<string | null>(null)

  useEffect(() => {
    if (!src) return

    // Use direct CloudFront URL for better compatibility (working implementation)
    if (src.includes('cloudfront.net') || src.includes('.amazonaws.com')) {
      // Use direct CloudFront URL
      setFinalUrl(src)
      console.log('🌐 Using direct CloudFront URL for 360° content:', src)
    } else {
      // Direct URL, use as-is
      setFinalUrl(src)
    }
  }, [src])

  useEffect(() => {
    if (!finalUrl || vrFailed) return
    
    // Use A-Frame for CloudFront URLs and localhost/proxy URLs
    if (finalUrl.includes('localhost') || finalUrl.includes('127.0.0.1') || finalUrl.includes('/api/vr-proxy') || finalUrl.includes('cloudfront.net') || finalUrl.includes('.amazonaws.com')) {
      setShowAFrame(true)
      
      // Check if it's a video file and if it's MOV format
      const isVideo = type === 'video' || type === 'video360' || type === 'vr'
      const isMOV = finalUrl.toLowerCase().includes('.mov')
      
      if (isVideo && isMOV) {
        setVrFailed(true)
        setIsLoaded(true)
        onReady?.()
        return
      }

      const aFrameHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
          <style>
            html, body { 
              margin: 0; 
              padding: 0; 
              touch-action: none;
              -webkit-touch-callout: none;
              -webkit-user-select: none;
              user-select: none;
              overflow: hidden;
            }
            a-scene { 
              width: 100%; 
              height: 100vh; 
              touch-action: none;
            }
            * {
              touch-action: none;
            }
          </style>
        </head>
        <body>
          <a-scene embedded vr-mode-ui="enabled: true">
            ${isVideo ? 
              `<a-videosphere src="${finalUrl}" rotation="0 -90 0"></a-videosphere>` : 
              `<a-sky src="${finalUrl}" rotation="0 -90 0"></a-sky>`
            }
            <a-camera 
              position="0 1.6 0" 
              look-controls="reverseMouseDrag: true; touchEnabled: true; pointerLockEnabled: false; gyroscopeEnabled: true;"
            ></a-camera>
          </a-scene>
        </body>
        </html>
      `
      setAFrameHTML(aFrameHTML)
      setIsLoaded(true)
      onReady?.()
    } else {
      // For other public URLs, use Google VR View
      setShowAFrame(false)
      
      const params = new URLSearchParams()
      
      if (type === 'image' || type === 'image360') {
        params.set('image', finalUrl)
      } else {
        params.set('video', finalUrl)
      }
      
      if (preview) params.set('preview', preview)
      if (isStereo) params.set('is_stereo', 'true')
      
      const vrViewUrl = `https://storage.googleapis.com/vrview/index.html?${params.toString()}`
      setIframeSrc(vrViewUrl)
      setIsLoaded(true)
      onReady?.()
    }
  }, [finalUrl, vrFailed, type, preview, isStereo, onReady])


  // Check if it's a MOV file and show specific error
  const isVideo = type === 'video' || type === 'video360' || type === 'vr'
  const isMOV = finalUrl.toLowerCase().includes('.mov')
  
  if (vrFailed && isVideo && isMOV) {
    return (
      <div 
        ref={containerRef}
        style={{ 
          width, 
          height, 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          textAlign: 'center',
          padding: '20px',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎥</div>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600' }}>VR Video Format Issue</h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', opacity: '0.9', maxWidth: '300px' }}>
          MOV files are not supported by VR viewers. Please convert to MP4 format for the best VR experience.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <a 
            href="https://convertio.co/mov-mp4/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '14px',
              border: '1px solid rgba(255,255,255,0.3)'
            }}
          >
            Convert to MP4
          </a>
          <button 
            onClick={() => window.open(finalUrl, '_blank')}
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.3)',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Download Video
          </button>
        </div>
      </div>
    )
  }

  if (vrFailed) {
    return (
      <div 
        ref={containerRef}
        style={{ 
          width, 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          color: '#6b7280'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🥽</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>VR View Unavailable</h3>
          <p style={{ margin: '0', fontSize: '14px' }}>Unable to load VR content</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full"
      style={{ 
        width, 
        height, 
        position: 'relative',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        overflow: 'hidden',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
    >
      {!isLoaded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
          color: '#6b7280'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
            <div style={{ fontSize: '14px' }}>Loading VR content...</div>
          </div>
        </div>
      )}
      
      {isLoaded && showAFrame && aFrameHTML && (
        <iframe
          srcDoc={aFrameHTML}
          width="100%"
          height="100%"
          frameBorder="0"
          className="w-full h-full"
          style={{ 
            border: 'none', 
            borderRadius: '8px',
            touchAction: 'none',
            pointerEvents: 'auto'
          }}
          onLoad={() => {}}
          onError={() => {
            console.error('❌ A-Frame iframe failed to load')
            setVrFailed(true)
            onError?.('Failed to load A-Frame VR view')
          }}
        />
      )}
      
      {isLoaded && !showAFrame && iframeSrc && (
        <iframe
          src={iframeSrc}
          width="100%"
          height="100%"
          frameBorder="0"
          className="w-full h-full"
          style={{ border: 'none', borderRadius: '8px' }}
          onLoad={() => {}}
          onError={() => {
            console.error('❌ Google VR View iframe failed to load')
            setVrFailed(true)
            onError?.('Failed to load VR view')
          }}
        />
      )}
    </div>
  )
}

export default GoogleVRView
