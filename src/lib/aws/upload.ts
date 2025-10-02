import { uploadToS3, generateS3Key, getCloudFrontUrl } from './s3';
import { getAuth } from 'firebase/auth';

/**
 * Hybrid media upload function that uses AWS S3 instead of Firebase Storage
 * Maintains the same interface as the original uploadMedia function
 * @param file - The file to upload
 * @param onProgress - Optional progress callback
 * @returns Promise<string> - The CloudFront URL of the uploaded file
 */
export async function uploadMedia(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to upload media');

  // Determine content type based on file type
  let contentType: 'images' | 'videos' | 'audio' | 'documents';
  if (file.type.startsWith('image/')) {
    contentType = 'images';
  } else if (file.type.startsWith('video/')) {
    contentType = 'videos';
  } else if (file.type.startsWith('audio/')) {
    contentType = 'audio';
  } else {
    contentType = 'documents';
  }

  // Generate S3 key
  const s3Key = generateS3Key(user.uid, file.name, contentType);

  try {
    console.log(`📤 Starting upload: ${file.name} (${file.size} bytes)`);
    
    // Add timeout to prevent hanging (30 minutes for large files)
    const timeoutMs = 30 * 60 * 1000; // 30 minutes
    const uploadPromise = uploadToS3(file, s3Key, onProgress);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Upload timeout - file too large or connection issue')), timeoutMs);
    });
    
    // Upload to S3 with timeout
    const cloudFrontUrl = await Promise.race([uploadPromise, timeoutPromise]);
    
    // Simulate progress for consistency with Firebase Storage
    if (onProgress) {
      onProgress(100);
    }
    
    return cloudFrontUrl;
  } catch (error) {
    console.error('❌ Error uploading to S3:', error);
    throw error;
  }
}

/**
 * Upload media for chat messages (images, videos, audio)
 * @param file - The file to upload
 * @param chatId - The chat ID
 * @param onProgress - Optional progress callback
 * @returns Promise<string> - The CloudFront URL of the uploaded file
 */
export async function uploadChatMedia(
  file: File,
  chatId: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to upload media');

  // Determine content type
  let contentType: 'images' | 'videos' | 'audio' | 'documents';
  if (file.type.startsWith('image/')) {
    contentType = 'images';
  } else if (file.type.startsWith('video/')) {
    contentType = 'videos';
  } else if (file.type.startsWith('audio/')) {
    contentType = 'audio';
  } else {
    contentType = 'documents';
  }

  // Generate S3 key for chat media
  const s3Key = `chats/${chatId}/${contentType}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

  try {
    // Upload to S3
    const cloudFrontUrl = await uploadToS3(file, s3Key, onProgress);
    
    // Simulate progress for consistency
    if (onProgress) {
      onProgress(100);
    }
    
    return cloudFrontUrl;
  } catch (error) {
    console.error('Error uploading chat media to S3:', error);
    throw error;
  }
}

/**
 * Upload audio for voice messages
 * @param blob - The audio blob
 * @param onProgress - Optional progress callback
 * @returns Promise<string> - The CloudFront URL of the uploaded file
 */
export async function uploadAudio(
  blob: Blob,
  onProgress?: (progress: number) => void
): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to upload audio');

  // Create a file from the blob
  const file = new File([blob], `voice_${Date.now()}.mp3`, { type: 'audio/mpeg' });
  
  // Generate S3 key for audio
  const s3Key = generateS3Key(user.uid, file.name, 'audio');

  try {
    // Upload to S3
    const cloudFrontUrl = await uploadToS3(file, s3Key, onProgress);
    
    // Simulate progress for consistency
    if (onProgress) {
      onProgress(100);
    }
    
    return cloudFrontUrl;
  } catch (error) {
    console.error('Error uploading audio to S3:', error);
    throw error;
  }
}

/**
 * Legacy function for backward compatibility
 * This maintains the same interface as the original Firebase Storage function
 * @param file - The file to upload
 * @param onProgress - Optional progress callback
 * @returns Promise<string> - The CloudFront URL of the uploaded file
 */
export async function uploadMediaLegacy(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Use the new S3 upload function
  return uploadMedia(file, onProgress);
}
