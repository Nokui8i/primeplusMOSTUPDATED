'use client'

import React, { useState } from 'react'
import VRMediaPlayer, { detectVRMediaType, isVRMediaSupported, getSupportedVRMimeTypes } from '@/components/media/VRMediaPlayer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, Play, Pause, RotateCcw } from 'lucide-react'

export default function VRMediaPlayerExample() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [detectedType, setDetectedType] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState<boolean>(false)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      
      // זיהוי אוטומטי של סוג התוכן
      const type = detectVRMediaType(file)
      setDetectedType(type)
      setIsSupported(isVRMediaSupported(file))
    }
  }

  const exampleMedia = [
    {
      type: 'video360' as const,
      src: 'https://example.com/video360.mp4',
      title: '360° Video Example',
      description: 'Professional 360° video player with Video.js'
    },
    {
      type: 'image360' as const,
      src: 'https://example.com/image360.jpg',
      title: '360° Image Example',
      description: 'Interactive 360° image with hotspots'
    },
    {
      type: 'vr' as const,
      src: 'https://example.com/vr-content.mp4',
      title: 'VR Content Example',
      description: 'Immersive VR experience with stereo support'
    },
    {
      type: 'ar' as const,
      src: 'https://example.com/ar-content.mp4',
      title: 'AR Content Example',
      description: 'Augmented reality content viewer'
    },
    {
      type: 'model' as const,
      src: 'https://example.com/model.gltf',
      title: '3D Model Example',
      description: 'Interactive 3D model viewer'
    }
  ]

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">🥽 VR Media Player Examples</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Unified VR/360° media player for PrimePlus+ platform
        </p>
      </div>

      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            File Upload & Detection
          </CardTitle>
          <CardDescription>
            Upload a file to automatically detect its VR/360° type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept={getSupportedVRMimeTypes().join(',')}
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          
          {selectedFile && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="font-semibold mb-2">File Analysis:</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Name:</strong> {selectedFile.name}</p>
                <p><strong>Type:</strong> {selectedFile.type}</p>
                <p><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                <p><strong>Detected Type:</strong> 
                  <Badge variant={detectedType ? "default" : "destructive"} className="ml-2">
                    {detectedType || 'Unknown'}
                  </Badge>
                </p>
                <p><strong>Supported:</strong> 
                  <Badge variant={isSupported ? "default" : "destructive"} className="ml-2">
                    {isSupported ? 'Yes' : 'No'}
                  </Badge>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Player Examples */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {exampleMedia.map((media, index) => (
          <Card key={index} className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{media.title}</CardTitle>
                <Badge variant="outline">{media.type.toUpperCase()}</Badge>
              </div>
              <CardDescription>{media.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <VRMediaPlayer
                type={media.type}
                src={media.src}
                title={media.title}
                width="100%"
                height="300px"
                onReady={() => console.log(`${media.type} player ready`)}
                onError={(error) => console.error(`${media.type} player error:`, error)}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>📖 Usage Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Basic Usage:</h3>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm overflow-x-auto">
{`import VRMediaPlayer from '@/components/media/VRMediaPlayer'

<VRMediaPlayer
  type="video360"
  src="https://example.com/video.mp4"
  title="My 360° Video"
  width="100%"
  height="400px"
  onReady={() => console.log('Ready!')}
  onError={(error) => console.error('Error:', error)}
/>`}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Supported Types:</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {['video360', 'image360', 'vr', 'ar', 'model'].map((type) => (
                <Badge key={type} variant="outline" className="text-center">
                  {type}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Features:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>🎥 Professional video player (Video.js VR)</li>
              <li>🖼️ Interactive 360° images with hotspots</li>
              <li>🥽 VR content with stereo support</li>
              <li>📱 AR content viewer</li>
              <li>🎨 3D model viewer (GLTF/GLB)</li>
              <li>📱 Mobile-optimized controls</li>
              <li>🎨 Unified UI design</li>
              <li>⚡ Lazy loading for performance</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
