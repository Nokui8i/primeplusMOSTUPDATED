import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { PostType } from '@/lib/types/post'
import { Video } from '@/components/ui/video'
import dynamic from 'next/dynamic'
import { Hotspot } from '@/lib/types/media'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { X, Maximize2, Minimize2 } from 'lucide-react'
import { loadImage } from '@/lib/utils/imageUtils'
import { useAuth } from '@/lib/firebase/auth'
import { ErrorBoundary } from 'react-error-boundary'
import { ContentWatermark } from '@/components/media/ContentWatermark'

const GoogleVRImageView = dynamic(() => import('@/components/media/GoogleVRImageView'), { 
  ssr: false,
  loading: () => <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 animate-pulse" />
})

const GoogleVRVideoView = dynamic(() => import('@/components/media/GoogleVRVideoView'), { 
  ssr: false,
  loading: () => <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 animate-pulse" />
})

const AFrameModelViewer = dynamic(() => import('@/components/media/AFrameModelViewer'), { 
  ssr: false,
  loading: () => <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 animate-pulse" />
})

const VRMediaPlayer = dynamic(() => import('@/components/media/VRMediaPlayer'), { 
  ssr: false,
  loading: () => <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 animate-pulse" />
})

interface MediaContentProps {
  url: string
  type: PostType
  thumbnailUrl?: string
  compact?: boolean
  hotspots?: Hotspot[]
  dimensions?: {
    width: number
    height: number
    aspectRatio: number
  }
  metadata?: {
    width?: number
    height?: number
    duration?: number
    mimeType?: string
    aspectRatio?: string
  }
  username?: string
  showWatermark?: boolean
}

function MediaErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center p-4">
      <p className="text-red-500 mb-2">Failed to load media</p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}

export default function MediaContent({ url, type, thumbnailUrl, compact, hotspots, dimensions, metadata, username, showWatermark = true }: MediaContentProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [correctedUrl, setCorrectedUrl] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const { user } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isMounted, setIsMounted] = useState(false)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  useEffect(() => {
    if (type === 'image' && url) {
      console.log('🖼️ Loading image:', { url, type })
      setIsLoading(true)
      setError(false)
      
      loadImage(url)
        .then((correctedDataUrl: string) => {
          setCorrectedUrl(correctedDataUrl)
          setIsLoading(false)
        })
        .catch((err) => {
          console.error('❌ Error loading image:', err, 'URL:', url)
          setError(true)
          setIsLoading(false)
        })
    }
  }, [url, type])

  // Fullscreen API handlers
  useEffect(() => {
    function handleFullscreenChange() {
      const isFull =
        document.fullscreenElement === videoContainerRef.current ||
        (document as any).webkitFullscreenElement === videoContainerRef.current
      setIsVideoFullscreen(isFull)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [])

  const enterVideoFullscreen = () => {
    const el = videoContainerRef.current
    if (!el) return
    if (el.requestFullscreen) el.requestFullscreen()
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen()
  }
  const exitVideoFullscreen = () => {
    if (document.exitFullscreen) document.exitFullscreen()
    else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen()
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const newScale = scale + (e.deltaY > 0 ? -0.1 : 0.1)
    setScale(Math.min(Math.max(1, newScale), 3))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  const renderMedia = () => {
    switch (type) {
      case 'image':
        return (
          <div className="post-image-container relative w-full mx-auto rounded-lg overflow-hidden aspect-video">
            <div
              className="relative flex justify-center items-center overflow-hidden h-full"
              style={{ transform: `scale(${1.02})`, transition: 'transform 0.3s' }}
            >
              {!error && (
                <div className="relative w-full h-full">
                  <Image
                    src={correctedUrl || url}
                    alt="Post image"
                    priority={!compact}
                    width={dimensions?.width || metadata?.width || 1920}
                    height={dimensions?.height || metadata?.height || 1080}
                    className={`
                      post-image w-full h-full object-contain
                      ${isLoading ? 'blur-sm' : ''}
                      transition-transform duration-300
                    `}
                    onClick={() => setShowLightbox(true)}
                    onError={() => {
                      console.error('Image failed to load:', url)
                      setError(true)
                      setIsLoading(false)
                    }}
                    style={{
                      cursor: 'pointer',
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                  {username && showWatermark && <ContentWatermark username={username} />}
                </div>
              )}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <div className="text-sm text-gray-600">Loading image...</div>
                  </div>
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-red-500">Failed to load image</div>
                    <button 
                      className="text-sm text-blue-500 hover:text-blue-600"
                      onClick={() => {
                        setError(false)
                        setIsLoading(true)
                        loadImage(url)
                          .then((correctedDataUrl: string) => {
                            setCorrectedUrl(correctedDataUrl)
                            setIsLoading(false)
                          })
                          .catch(() => {
                            setError(true)
                            setIsLoading(false)
                          })
                      }}
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 'video':
        return (
          <div ref={videoContainerRef} className={`relative w-full${isVideoFullscreen ? ' fixed inset-0 z-[1000] bg-black' : ''}`}> 
            <div className="relative w-full aspect-video rounded-lg overflow-hidden">
              <Video 
                src={url} 
                thumbnail={thumbnailUrl} 
                className="w-full h-full object-contain rounded-lg z-10"
                controls={true}
                watermark={username && showWatermark ? <ContentWatermark username={username} /> : undefined}
              />
              {/* Watermark - shows in normal mode */}
              {username && showWatermark && <ContentWatermark username={username} />}
              {/* Custom Fullscreen Button */}
              {!isVideoFullscreen && (
                <button
                  type="button"
                  onClick={enterVideoFullscreen}
                  className="absolute bottom-4 right-4 z-30 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors"
                  style={{ pointerEvents: 'auto' }}
                  aria-label="Enter Fullscreen"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              )}
              {isVideoFullscreen && (
                <button
                  type="button"
                  onClick={exitVideoFullscreen}
                  className="absolute bottom-4 right-4 z-30 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors"
                  style={{ pointerEvents: 'auto' }}
                  aria-label="Exit Fullscreen"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )

      case 'image360':
        return (
          <div className="relative w-full aspect-video">
            <VRMediaPlayer
              type="image360"
              src={url}
              width="100%"
              height="100%"
              hotspots={hotspots as any}
              onHotspotClick={(hotspotId) => {
                console.log('Hotspot clicked:', hotspotId);
              }}
            />
            {username && showWatermark && <ContentWatermark username={username} />}
          </div>
        )

      case 'video360':
        return (
          <div className="relative w-full aspect-video">
            <VRMediaPlayer
              type="video360"
              src={url}
              poster={thumbnailUrl}
              width="100%"
              height="100%"
              onReady={() => console.log('VR video ready')}
              onError={(error) => console.error('VR video error:', error)}
              username={username}
              showWatermark={showWatermark}
            />
          </div>
        )

      case 'vr':
        return (
          <div className="relative w-full aspect-video">
            <VRMediaPlayer
              type="vr"
              src={url}
              width="100%"
              height="100%"
              isStereo={true}
              onReady={() => console.log('VR content ready')}
              onError={(error) => console.error('VR content error:', error)}
              username={username}
              showWatermark={showWatermark}
            />
          </div>
        )

      case 'ar':
        return (
          <div className="relative w-full" style={{ height: compact ? '300px' : '400px' }}>
            <VRMediaPlayer
              type="ar"
              src={url}
              width="100%"
              height="100%"
              onReady={() => console.log('AR content ready')}
              onError={(error) => console.error('AR content error:', error)}
            />
            {username && showWatermark && <ContentWatermark username={username} />}
          </div>
        )

      case 'audio':
        return (
          <div className="relative w-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
            <audio 
              src={url} 
              controls 
              className="w-full"
              preload="metadata"
            />
            {username && showWatermark && <ContentWatermark username={username} />}
          </div>
        )

      case 'text':
      case 'live_stream':
      default:
        return (
          <div className="relative flex items-center justify-center p-4 bg-gray-100 rounded-lg">
            <p className="text-gray-600">Unsupported media type</p>
            {username && showWatermark && <ContentWatermark username={username} />}
          </div>
        )
    }
  }

  return (
    <ErrorBoundary FallbackComponent={MediaErrorFallback}>
      {renderMedia()}

      {/* Lightbox Modal for Images */}
      {type === 'image' && isMounted && (
        <Dialog open={showLightbox} onOpenChange={setShowLightbox}>
          <DialogContent 
            className="max-w-[95vw] max-h-[95vh] p-0 bg-black/90 border-none"
          >
            <DialogTitle className="sr-only">Image Viewer</DialogTitle>
            <DialogDescription className="sr-only">
              Full size image viewer with zoom and pan controls. Use mouse wheel to zoom, click and drag to pan.
            </DialogDescription>
            <div 
              ref={containerRef} 
              className="relative w-full h-full flex items-center justify-center overflow-hidden"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => setShowLightbox(false)}
                className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                aria-label="Close full size image viewer"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="relative w-full h-full">
                <img
                  src={correctedUrl || url}
                  alt="Full size image"
                  className="max-w-full max-h-[90vh] object-contain"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s'
                  }}
                  onWheel={handleWheel}
                  draggable={false}
                />
                {username && showWatermark && <ContentWatermark username={username} />}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* Lightbox Modal for Videos */}
      {type === 'video' && isMounted && showLightbox && (
        <Dialog open={showLightbox} onOpenChange={setShowLightbox}>
          <DialogContent 
            className="max-w-[95vw] max-h-[95vh] p-0 bg-black/90 border-none"
          >
            <DialogTitle className="sr-only">Video Viewer</DialogTitle>
            <DialogDescription className="sr-only">
              Full size video viewer. Use controls to play, pause, and seek.
            </DialogDescription>
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <button
                onClick={() => setShowLightbox(false)}
                className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                aria-label="Close full size video viewer"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="relative w-full h-full">
                <video
                  src={url}
                  poster={thumbnailUrl}
                  className="w-full max-h-[90vh] object-contain rounded-lg bg-black"
                  controls
                  autoPlay
                  playsInline
                  style={{ background: '#000' }}
                />
                {username && showWatermark && <ContentWatermark username={username} />}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </ErrorBoundary>
  )
} 