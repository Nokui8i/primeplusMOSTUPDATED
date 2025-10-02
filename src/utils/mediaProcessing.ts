import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export const IMAGE_QUALITY_SETTINGS = {
  high: {
    format: 'image/webp',
    quality: 0.95
  },
  medium: {
    format: 'image/webp',
    quality: 0.85
  },
  low: {
    format: 'image/webp',
    quality: 0.75
  }
};

let ffmpeg: FFmpeg | null = null;

export const initFFmpeg = async () => {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(`/ffmpeg/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`/ffmpeg/ffmpeg-core.wasm`, 'application/wasm'),
    });
  }
  return ffmpeg;
};

export const processImage = async (file: File, quality: keyof typeof IMAGE_QUALITY_SETTINGS) => {
  return new Promise<Blob>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate dimensions while maintaining aspect ratio
      const maxDimension = 3840; // 4K max dimension
      let width = img.width;
      let height = img.height;
      
      // Only resize if image is larger than max dimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      
      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;
      
      // Enable image smoothing for better quality
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }
      
      // Draw image with high quality settings
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Convert to WebP with specified quality
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Create a new file with WebP extension
            const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
              type: 'image/webp'
            });
            resolve(webpFile);
          }
        },
        'image/webp',
        IMAGE_QUALITY_SETTINGS[quality].quality
      );
    };
    
    // Handle image loading errors
    img.onerror = () => {
      console.error('Error loading image for processing');
      resolve(file); // Return original file if processing fails
    };
    
    img.src = URL.createObjectURL(file);
  });
}; 