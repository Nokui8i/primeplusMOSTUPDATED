import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

class VideoConverter {
  private ffmpeg: FFmpeg | null = null
  private isLoaded = false

  async initialize() {
    if (this.isLoaded) return

    try {
      this.ffmpeg = new FFmpeg()
      
      // Load FFmpeg with optimized settings for web
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      
      this.isLoaded = true
    } catch (error) {
      console.error('❌ Failed to load FFmpeg:', error)
      throw new Error('Failed to initialize video converter')
    }
  }

  async convertMOVtoMP4(movFile: File, onProgress?: (progress: number) => void): Promise<File> {
    if (!this.ffmpeg || !this.isLoaded) {
      await this.initialize()
    }

    if (!this.ffmpeg) {
      throw new Error('FFmpeg not initialized')
    }

    try {
      
      // Set up progress callback
      if (onProgress) {
        this.ffmpeg.on('progress', ({ progress }) => {
          onProgress(progress * 100)
        })
      }

      // Write input file
      const inputFileName = 'input.mov'
      const outputFileName = 'output.mp4'
      
      await this.ffmpeg.writeFile(inputFileName, await fetchFile(movFile))

      // Convert MOV to MP4 with high quality settings for VR content
      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-c:v', 'libx264',           // H.264 codec for best compatibility
        '-c:a', 'aac',               // AAC audio codec
        '-preset', 'medium',         // Better quality encoding
        '-crf', '18',                // High quality (lower = better quality)
        '-b:v', '10M',               // High bitrate for VR content
        '-maxrate', '15M',           // Maximum bitrate
        '-bufsize', '20M',           // Buffer size
        '-movflags', '+faststart',   // Optimize for web streaming
        '-pix_fmt', 'yuv420p',       // Ensure compatibility
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // Ensure even dimensions
        outputFileName
      ])

      // Read output file
      const data = await this.ffmpeg.readFile(outputFileName)
      
      // Create new File object with converted name
      const originalName = movFile.name.replace(/\.mov$/i, '')
      const convertedFile = new File(
        [data], 
        `${originalName}_converted.mp4`, 
        { type: 'video/mp4' }
      )

      // Clean up files
      await this.ffmpeg.deleteFile(inputFileName)
      await this.ffmpeg.deleteFile(outputFileName)

      return convertedFile

    } catch (error) {
      console.error('❌ Conversion failed:', error)
      throw new Error(`Failed to convert MOV to MP4: ${error}`)
    }
  }

  async convertToMP4(file: File, onProgress?: (progress: number) => void): Promise<File> {
    const fileName = file.name.toLowerCase()
    
    // Check if conversion is needed
    if (fileName.endsWith('.mp4')) {
      return file // Already MP4
    }
    
    if (fileName.endsWith('.mov')) {
      return this.convertMOVtoMP4(file, onProgress)
    }
    
    // For other formats, try generic conversion
    if (!this.ffmpeg || !this.isLoaded) {
      await this.initialize()
    }

    if (!this.ffmpeg) {
      throw new Error('FFmpeg not initialized')
    }

    try {
      
      // Set up progress callback
      if (onProgress) {
        this.ffmpeg.on('progress', ({ progress }) => {
          onProgress(progress * 100)
        })
      }

      const inputFileName = `input.${file.name.split('.').pop()}`
      const outputFileName = 'output.mp4'
      
      await this.ffmpeg.writeFile(inputFileName, await fetchFile(file))

      // Generic conversion to MP4 with high quality settings
      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'medium',
        '-crf', '18',
        '-b:v', '8M',
        '-maxrate', '12M',
        '-bufsize', '16M',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
        outputFileName
      ])

      const data = await this.ffmpeg.readFile(outputFileName)
      
      const originalName = file.name.replace(/\.[^.]+$/, '')
      const convertedFile = new File(
        [data], 
        `${originalName}_converted.mp4`, 
        { type: 'video/mp4' }
      )

      // Clean up
      await this.ffmpeg.deleteFile(inputFileName)
      await this.ffmpeg.deleteFile(outputFileName)

      return convertedFile

    } catch (error) {
      console.error('❌ Generic conversion failed:', error)
      throw new Error(`Failed to convert ${file.name} to MP4: ${error}`)
    }
  }

  // Check if file needs conversion
  needsConversion(file: File): boolean {
    const fileName = file.name.toLowerCase()
    const fileType = file.type.toLowerCase()
    
    
    // Only convert video files, not images
    if (!fileType.startsWith('video/')) {
      return false
    }
    
    // Check by file extension
    const supportedFormats = ['.mp4', '.webm', '.mkv']
    const hasSupportedExtension = supportedFormats.some(format => fileName.endsWith(format))
    
    // Check by MIME type
    const supportedMimeTypes = ['video/mp4', 'video/webm', 'video/x-matroska']
    const hasSupportedMimeType = supportedMimeTypes.some(type => fileType.includes(type))
    
    const needsConversion = !hasSupportedExtension && !hasSupportedMimeType
    
    
    // Need conversion if neither extension nor MIME type is supported
    return needsConversion
  }

  // Get supported input formats
  getSupportedInputFormats(): string[] {
    return [
      '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', 
      '.m4v', '.3gp', '.ogv', '.mp4'
    ]
  }

  // Clean up resources
  async cleanup() {
    if (this.ffmpeg) {
      try {
        await this.ffmpeg.terminate()
        this.ffmpeg = null
        this.isLoaded = false
        console.log('🧹 FFmpeg cleaned up')
      } catch (error) {
        console.error('❌ Error cleaning up FFmpeg:', error)
      }
    }
  }
}

// Export singleton instance
export const videoConverter = new VideoConverter()

// Export utility functions
export const convertVideoFile = async (
  file: File, 
  onProgress?: (progress: number) => void
): Promise<File> => {
  return videoConverter.convertToMP4(file, onProgress)
}

export const needsVideoConversion = (file: File): boolean => {
  return videoConverter.needsConversion(file)
}

export const getSupportedVideoFormats = (): string[] => {
  return videoConverter.getSupportedInputFormats()
}
