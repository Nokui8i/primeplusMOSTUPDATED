'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { Hotspot } from '@/types/vr'

// Helper function to convert Hotspot to GoogleVRView format
const convertHotspotsToGoogleVR = (hotspots?: Hotspot[]) => {
  if (!hotspots) return undefined;
  
  return hotspots.map(hotspot => {
    // Parse position string "x y z" to extract pitch and yaw
    const positionParts = hotspot.position?.split(' ').map(Number) || [0, 0, 0];
    const [x, y, z] = positionParts;
    
    // Convert 3D position to spherical coordinates (pitch, yaw)
    const pitch = Math.asin(y) * (180 / Math.PI);
    const yaw = Math.atan2(x, z) * (180 / Math.PI);
    
    return {
      id: hotspot.id,
      pitch: pitch || 0,
      yaw: yaw || 0,
      text: hotspot.text
    };
  });
};

// 📌 טוענים דינמית כדי למנוע בעיות עם SSR ב-Next.js
const GoogleVRView = dynamic(() => import('./GoogleVRView'), { 
  ssr: false,
  loading: () => (
    <div className="w-full aspect-video bg-gray-900 rounded-2xl flex items-center justify-center">
      <div className="text-white text-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <div className="text-sm">Loading VR content...</div>
      </div>
    </div>
  )
})

const AFrameModelViewer = dynamic(() => import('./AFrameModelViewer'), { 
  ssr: false,
  loading: () => (
    <div className="w-full aspect-video bg-gray-900 rounded-2xl flex items-center justify-center">
      <div className="text-white text-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <div className="text-sm">Loading 3D model...</div>
      </div>
    </div>
  )
})

const VRVideoPlayer = dynamic(() => import('./VRVideoPlayer'), { 
  ssr: false,
  loading: () => (
    <div className="w-full aspect-video bg-gray-900 rounded-2xl flex items-center justify-center">
      <div className="text-white text-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <div className="text-sm">Loading VR video...</div>
      </div>
    </div>
  )
})

// 🥽 סוגי המדיה הנתמכים
export type VRMediaType = 'video360' | 'image360' | 'vr' | 'ar' | 'model'

interface VRMediaPlayerProps {
  type: VRMediaType
  src: string
  title?: string
  poster?: string
  width?: string
  height?: string
  preview?: string
  isStereo?: boolean
  onReady?: () => void
  onError?: (error: string) => void
  hotspots?: Hotspot[]
  onHotspotClick?: (hotspotId: string) => void
  className?: string
  username?: string
  showWatermark?: boolean
}

export default function VRMediaPlayer({ 
  type, 
  src, 
  title, 
  poster, 
  width = '100%', 
  height = '400px',
  preview,
  isStereo = false,
  onReady,
  onError,
  hotspots = [],
  onHotspotClick,
  className = '',
  username,
  showWatermark = true
}: VRMediaPlayerProps) {
  // 🎯 לוגיקת בחירת הנגן המקצועית
  const renderPlayer = () => {
    switch (type) {
      case 'video360':
        return (
          <VRVideoPlayer
            src={src}
            projection="360"
            quality="auto"
            autoplay={false}
            muted={false}
            poster={poster}
            width={width}
            height={height}
            hotspots={hotspots}
            onHotspotClick={onHotspotClick}
            onError={onError}
            username={username}
            showWatermark={showWatermark}
          />
        )

      case 'image360':
        return (
          <GoogleVRView
            src={src}
            type="image360"
            width={width}
            height={height}
            preview={preview}
            isStereo={isStereo}
            onReady={onReady}
            onError={onError}
            hotspots={convertHotspotsToGoogleVR(hotspots)}
            onHotspotClick={onHotspotClick}
          />
        )

      case 'vr':
        return (
          <GoogleVRView
            src={src}
            type="vr"
            width={width}
            height={height}
            preview={preview}
            isStereo={isStereo}
            onReady={onReady}
            onError={onError}
            hotspots={convertHotspotsToGoogleVR(hotspots)}
            onHotspotClick={onHotspotClick}
          />
        )

      case 'ar':
        return (
          <GoogleVRView
            src={src}
            type="ar"
            width={width}
            height={height}
            preview={preview}
            isStereo={isStereo}
            onReady={onReady}
            onError={onError}
            hotspots={convertHotspotsToGoogleVR(hotspots)}
            onHotspotClick={onHotspotClick}
          />
        )

      case 'model':
        return (
          <AFrameModelViewer 
            src={src}
          />
        )

      default:
        return (
          <div className="w-full aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl flex items-center justify-center text-white">
            <div className="text-center">
              <div className="text-4xl mb-4">🥽</div>
              <h3 className="text-lg font-semibold mb-2">Unsupported VR Type</h3>
              <p className="text-sm opacity-75">Type: {type}</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div 
      className={`relative ${className}`}
      style={{ width, height }}
    >
      {/* 🎨 מסגרת אחידה עם עיצוב מקצועי */}
      <div 
        className="relative w-full h-full rounded-2xl overflow-hidden shadow-lg backdrop-blur-xl bg-white/5 border border-white/10"
        style={{ width, height }}
      >
        {/* 📱 כותרת (אופציונלית) */}
        {title && (
          <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
            <h3 className="text-white font-semibold text-lg truncate">{title}</h3>
          </div>
        )}

        {/* 🥽 הנגן עצמו */}
        <div className="relative w-full h-full">
          {renderPlayer()}
        </div>

        {/* 🏷️ Content type badge (compact circular) */}
        <div className="absolute top-3 right-3 z-20 pointer-events-none select-none">
          <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white text-[10px] font-semibold shadow-md">
            {type === 'video360' ? '360°' : type === 'image360' ? '360°' : type === 'vr' ? 'VR' : type === 'ar' ? 'AR' : 'VR'}
          </div>
        </div>
      </div>
    </div>
  )
}

// 🎯 קומפוננטה עזר לזיהוי סוג המדיה
export function detectVRMediaType(file: File): VRMediaType | null {
  const fileName = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()

  // וידאו 360°
  if (fileType.includes('video') && (fileName.includes('360') || fileName.includes('vr'))) {
    return 'video360'
  }

  // תמונה 360°
  if (fileType.includes('image') && (fileName.includes('360') || fileName.includes('vr'))) {
    return 'image360'
  }

  // תוכן VR
  if (fileType.includes('vr') || fileName.includes('vr')) {
    return 'vr'
  }

  // תוכן AR
  if (fileType.includes('ar') || fileName.includes('ar')) {
    return 'ar'
  }

  // מודל 3D
  if (fileType.includes('gltf') || fileType.includes('glb') || fileName.includes('.gltf') || fileName.includes('.glb')) {
    return 'model'
  }

  return null
}

// 🎯 קומפוננטה עזר לבדיקת תמיכה
export function isVRMediaSupported(file: File): boolean {
  return detectVRMediaType(file) !== null
}

// 🎯 קומפוננטה עזר לקבלת MIME types נתמכים
export function getSupportedVRMimeTypes(): string[] {
  return [
    'video/mp4',
    'video/webm',
    'image/jpeg',
    'image/png',
    'image/webp',
    'model/gltf+json',
    'model/gltf-binary',
    'application/vr',
    'application/360'
  ]
}
