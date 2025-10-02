export interface MediaValidationResult {
  isValid: boolean;
  error?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    format?: string;
  };
}

export const validate360Image = async (file: File): Promise<MediaValidationResult> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ isValid: false, error: 'File must be an image' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      resolve({ 
        isValid: false, 
        error: 'Image must be in JPG or PNG format' 
      });
      return;
    }

    const img = new Image();
    img.onload = () => {
      // Check if image is likely equirectangular (2:1 aspect ratio)
      const aspectRatio = img.width / img.height;
      const isEquirectangular = Math.abs(aspectRatio - 2) < 0.1;

      if (!isEquirectangular) {
        resolve({ 
          isValid: false, 
          error: 'Image must be in equirectangular format (2:1 aspect ratio)' 
        });
        return;
      }

      resolve({
        isValid: true,
        metadata: {
          width: img.width,
          height: img.height,
          format: file.type
        }
      });
    };

    img.onerror = () => {
      resolve({ isValid: false, error: 'Failed to load image' });
    };

    img.src = URL.createObjectURL(file);
  });
};

export const validate360Video = async (file: File): Promise<MediaValidationResult> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/')) {
      resolve({ isValid: false, error: 'File must be a video' });
      return;
    }

    const allowedTypes = ['video/mp4', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      resolve({ 
        isValid: false, 
        error: 'Video must be in MP4 or WebM format' 
      });
      return;
    }

    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      // Check if video is likely equirectangular (2:1 aspect ratio)
      const aspectRatio = video.videoWidth / video.videoHeight;
      const isEquirectangular = Math.abs(aspectRatio - 2) < 0.1;

      if (!isEquirectangular) {
        resolve({ 
          isValid: false, 
          error: 'Video must be in equirectangular format (2:1 aspect ratio)' 
        });
        return;
      }

      // Check resolution (recommend minimum 4K for VR)
      if (video.videoWidth < 3840) {
        resolve({ 
          isValid: false, 
          error: 'Video resolution should be at least 4K (3840x1920) for optimal VR experience' 
        });
        return;
      }

      resolve({
        isValid: true,
        metadata: {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          format: file.type
        }
      });
    };

    video.onerror = () => {
      resolve({ isValid: false, error: 'Failed to load video' });
    };

    video.src = URL.createObjectURL(file);
  });
}; 