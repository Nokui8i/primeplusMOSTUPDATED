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

  useEffect(() => {
    if (!src) return


    // Check if this is a CloudFront or direct S3 URL
    if (src.includes('cloudfront.net') || src.includes('.amazonaws.com')) {
      try {
        const s3Key = extractS3KeyFromUrl(src)
        
        if (s3Key) {
          // Use proxy for S3/CloudFront URLs
          const proxyUrl = `/api/vr-proxy?key=${encodeURIComponent(s3Key)}`
          const fullProxyUrl = `${window.location.origin}${proxyUrl}`
          setFinalUrl(fullProxyUrl)
          if (!vrFailed) {
            createVRViewIframe(fullProxyUrl)
          }
        } else {
          console.warn('⚠️ Could not extract S3 key from URL:', src)
          setFinalUrl(src)
          if (!vrFailed) {
            createVRViewIframe(src)
          }
        }
      } catch (error) {
        console.error('❌ Error processing S3 URL:', error)
        setFinalUrl(src)
        if (!vrFailed) {
          createVRViewIframe(src)
        }
      }
    } else {
      // Direct URL, use as-is
      setFinalUrl(src)
      if (!vrFailed) {
        createVRViewIframe(src)
      }
    }
  }, [src, vrFailed])

  const createVRViewIframe = (sourceUrl: string) => {
    if (!containerRef.current) return

    // Check if this is a localhost URL or our proxy URL - if so, use A-Frame instead of Google VR View
    if (sourceUrl.includes('localhost') || sourceUrl.includes('127.0.0.1') || sourceUrl.includes('/api/vr-proxy')) {
      createAFrameView(sourceUrl)
      return
    }

    const iframe = document.createElement('iframe')
    const params = new URLSearchParams()
    
    if (type === 'image') {
      params.set('image', sourceUrl)
    } else {
      params.set('video', sourceUrl)
    }
    
    if (preview) params.set('preview', preview)
    if (isStereo) params.set('is_stereo', 'true')
    
    const vrViewUrl = `https://storage.googleapis.com/vrview/index.html?${params.toString()}`
    
    iframe.src = vrViewUrl
    iframe.width = width
    iframe.height = height
    iframe.frameBorder = '0'
    iframe.style.border = 'none'
    iframe.style.borderRadius = '8px'
    
    iframe.onload = () => {
      setIsLoaded(true)
      onReady?.()
    }
    
    iframe.onerror = () => {
      console.error('❌ Google VR View iframe failed to load')
      setVrFailed(true)
      onError?.('Failed to load VR view')
    }
    
    // Clear container and add iframe
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(iframe)
  }

  // Function to create A-Frame VR view for localhost URLs
  const createAFrameView = (sourceUrl: string) => {
    if (!containerRef.current) return

    // Check if it's a video file and if it's MOV format
    const isVideo = type === 'video' || type === 'video360' || type === 'vr'
    const isMOV = sourceUrl.toLowerCase().includes('.mov')
    
    if (isVideo && isMOV) {
      // Show error message for MOV files in A-Frame
      containerRef.current.innerHTML = `
        <div style="
          width: 100%; 
          height: ${height}; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          text-align: center;
          padding: 20px;
          box-sizing: border-box;
        ">
          <div style="font-size: 48px; margin-bottom: 16px;">🎥</div>
          <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">VR Video Format Issue</h3>
          <p style="margin: 0 0 16px 0; font-size: 14px; opacity: 0.9; max-width: 300px;">
            MOV files are not supported by VR viewers. Please convert to MP4 format for the best VR experience.
          </p>
          <div style="display: flex; gap: 12px; margin-top: 16px;">
            <a href="https://convertio.co/mov-mp4/" 
               target="_blank" 
               rel="noopener noreferrer"
               style="
                 background: rgba(255,255,255,0.2);
                 color: white;
                 padding: 8px 16px;
                 border-radius: 6px;
                 text-decoration: none;
                 font-size: 14px;
                 border: 1px solid rgba(255,255,255,0.3);
               "
            >
              Convert to MP4
            </a>
            <button 
              onclick="window.open('${sourceUrl}', '_blank')"
              style="
                background: rgba(255,255,255,0.2);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                border: 1px solid rgba(255,255,255,0.3);
                cursor: pointer;
                font-size: 14px;
              "
            >
              Download Video
            </button>
          </div>
        </div>
      `
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
          body { margin: 0; padding: 0; }
          a-scene { width: 100%; height: 100vh; }
        </style>
      </head>
      <body>
        <a-scene embedded vr-mode-ui="enabled: false">
          ${isVideo ? 
            `<a-videosphere src="${sourceUrl}" rotation="0 -90 0"></a-videosphere>` : 
            `<a-sky src="${sourceUrl}" rotation="0 -90 0"></a-sky>`
          }
          <a-camera position="0 1.6 0" look-controls="reverseMouseDrag: true"></a-camera>
        </a-scene>
      </body>
      </html>
    `

    const iframe = document.createElement('iframe')
    iframe.srcdoc = aFrameHTML
    iframe.width = '100%'
    iframe.height = height
    iframe.frameBorder = '0'
    iframe.style.border = 'none'
    iframe.style.borderRadius = '8px'
    
    // Clear container and add iframe
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(iframe)
    
    // Set loaded state
    setIsLoaded(true)
    onReady?.()
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
      style={{ 
        width, 
        height, 
        position: 'relative',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        overflow: 'hidden'
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
    </div>
  )
}

export default GoogleVRView
