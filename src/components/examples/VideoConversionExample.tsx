'use client'

import React, { useState } from 'react'
import { convertVideoFile, needsVideoConversion, getSupportedVideoFormats } from '@/lib/videoConverter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Upload, RefreshCw, CheckCircle2, XCircle, FileVideo } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function VideoConversionExample() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [convertedFile, setConvertedFile] = useState<File | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [conversionProgress, setConversionProgress] = useState(0)
  const [conversionError, setConversionError] = useState<string | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setConvertedFile(null)
      setConversionError(null)
      setConversionProgress(0)
    }
  }

  const handleConvert = async () => {
    if (!selectedFile) return

    setIsConverting(true)
    setConversionError(null)
    setConversionProgress(0)

    try {
      const converted = await convertVideoFile(selectedFile, (progress) => {
        setConversionProgress(progress)
      })

      setConvertedFile(converted)
      toast.success('Video converted successfully!')
    } catch (error) {
      console.error('Conversion failed:', error)
      setConversionError(error instanceof Error ? error.message : 'Conversion failed')
      toast.error('Conversion failed')
    } finally {
      setIsConverting(false)
    }
  }

  const downloadConverted = () => {
    if (!convertedFile) return

    const url = URL.createObjectURL(convertedFile)
    const a = document.createElement('a')
    a.href = url
    a.download = convertedFile.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const supportedFormats = getSupportedVideoFormats()

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">🎥 Video Conversion Example</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Test automatic MOV to MP4 conversion using FFmpeg.js
        </p>
      </div>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Video File
          </CardTitle>
          <CardDescription>
            Select a video file to test automatic conversion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept={supportedFormats.join(',')}
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          
          {selectedFile && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="font-semibold mb-2">Selected File:</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Name:</strong> {selectedFile.name}</p>
                <p><strong>Type:</strong> {selectedFile.type}</p>
                <p><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                <p><strong>Needs Conversion:</strong> 
                  <Badge variant={needsVideoConversion(selectedFile) ? "destructive" : "default"} className="ml-2">
                    {needsVideoConversion(selectedFile) ? 'Yes' : 'No'}
                  </Badge>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversion Controls */}
      {selectedFile && (
        <Card>
          <CardHeader>
            <CardTitle>Conversion Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleConvert}
              disabled={isConverting}
              className="w-full"
            >
              {isConverting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <FileVideo className="w-4 h-4 mr-2" />
                  Convert to MP4
                </>
              )}
            </Button>

            {isConverting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Conversion Progress</span>
                  <span>{Math.round(conversionProgress)}%</span>
                </div>
                <Progress value={conversionProgress} className="w-full" />
              </div>
            )}

            {conversionError && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <XCircle className="w-4 h-4" />
                  <span className="font-medium">Conversion Failed</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {conversionError}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conversion Result */}
      {convertedFile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Conversion Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h3 className="font-semibold mb-2 text-green-900 dark:text-green-100">Converted File:</h3>
              <div className="space-y-2 text-sm text-green-700 dark:text-green-300">
                <p><strong>Name:</strong> {convertedFile.name}</p>
                <p><strong>Type:</strong> {convertedFile.type}</p>
                <p><strong>Size:</strong> {(convertedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                <p><strong>Format:</strong> MP4 (H.264/AAC)</p>
              </div>
            </div>

            <Button onClick={downloadConverted} className="w-full">
              Download Converted File
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Supported Formats */}
      <Card>
        <CardHeader>
          <CardTitle>Supported Input Formats</CardTitle>
          <CardDescription>
            These formats will be automatically converted to MP4
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {supportedFormats.map((format) => (
              <Badge key={format} variant="outline" className="text-center">
                {format}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Automatic Conversion Process:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>User uploads a video file (MOV, AVI, MKV, etc.)</li>
              <li>System detects if conversion is needed</li>
              <li>FFmpeg.js converts the file to MP4 format</li>
              <li>Converted file is used for VR/360° content</li>
              <li>User sees progress bar during conversion</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Benefits:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>✅ No more "MOV not supported" errors</li>
              <li>✅ Automatic format optimization for VR</li>
              <li>✅ Client-side conversion (no server load)</li>
              <li>✅ Progress tracking and error handling</li>
              <li>✅ Seamless user experience</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
