// Client-side S3 operations using API routes
const CLOUDFRONT_DOMAIN = 'doelz7dqz8shj.cloudfront.net';

/**
 * Upload a file to AWS S3
 * @param file - The file to upload
 * @param key - The S3 key (path) for the file
 * @param onProgress - Optional progress callback
 * @returns Promise<string> - The CloudFront URL of the uploaded file
 */
export async function uploadToS3(
  file: File,
  key: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    console.log(`📤 Uploading to S3: ${file.name} -> ${key}`);
    
    // Create FormData for the API route
    const formData = new FormData();
    formData.append('file', file);
    formData.append('key', key);

    // Simulate progress updates for better UX
    if (onProgress) {
      onProgress(10); // Start
      setTimeout(() => onProgress(25), 100);
      setTimeout(() => onProgress(50), 500);
      setTimeout(() => onProgress(75), 1000);
    }

    // Upload via API route with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25 * 60 * 1000); // 25 minutes timeout

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Upload failed: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.url;
  } catch (error) {
    console.error('❌ Error uploading to S3:', error);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Upload timeout - file too large or connection issue');
      }
      throw error;
    }
    throw new Error('Failed to upload file to S3');
  }
}

/**
 * Delete a file from AWS S3
 * @param key - The S3 key (path) of the file to delete
 */
export async function deleteFromS3(key: string): Promise<void> {
  try {
    const response = await fetch('/api/upload/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key }),
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw new Error('Failed to delete file from S3');
  }
}

/**
 * Generate a unique S3 key for a file
 * @param userId - The user ID
 * @param fileName - The original file name
 * @param type - The type of content (images, videos, etc.)
 * @returns string - The S3 key
 */
export function generateS3Key(userId: string, fileName: string, type: 'images' | 'videos' | 'audio' | 'documents'): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
  return `content/${type}/${userId}/${timestamp}_${sanitizedFileName}`;
}

/**
 * Get CloudFront URL from S3 key
 * @param key - The S3 key
 * @returns string - The CloudFront URL
 */
export function getCloudFrontUrl(key: string): string {
  return `https://${CLOUDFRONT_DOMAIN}/${key}`;
}

/**
 * Check if a URL is a CloudFront URL
 * @param url - The URL to check
 * @returns boolean - True if it's a CloudFront URL
 */
export function isCloudFrontUrl(url: string): boolean {
  return url.includes(CLOUDFRONT_DOMAIN);
}

/**
 * Extract S3 key from CloudFront URL or direct S3 URL
 * @param url - The CloudFront URL or S3 URL
 * @returns string - The S3 key
 */
export function extractS3KeyFromUrl(url: string): string {
  if (isCloudFrontUrl(url)) {
    return url.replace(`https://${CLOUDFRONT_DOMAIN}/`, '');
  }
  
  // Handle direct S3 URLs
  if (url.includes('s3.amazonaws.com') || url.includes('s3.us-east-1.amazonaws.com')) {
    const urlParts = url.split('/');
    return urlParts.slice(3).join('/'); // Remove https://bucket.s3.region.amazonaws.com/
  }
  
  throw new Error('Not a CloudFront or S3 URL');
}

/**
 * Generate a signed URL for S3 access (for Google VR View)
 * @param key - The S3 key
 * @returns Promise<string> - The signed URL
 */
export async function getSignedUrl(key: string): Promise<string> {
  try {
    const response = await fetch('/api/s3-signed-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    const result = await response.json();
    return result.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw new Error('Failed to get signed URL');
  }
}

/**
 * Generate a CloudFront signed URL (preferred for VR content)
 * Falls back to S3 signed URL if CloudFront is not configured
 * @param key - The S3 key
 * @returns Promise<string> - The signed URL (CloudFront or S3)
 */
export async function getCloudFrontSignedUrl(key: string): Promise<string> {
  try {
    const response = await fetch(`/api/cloudfront-signed-url?key=${encodeURIComponent(key)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`Generated ${result.type} signed URL for key: ${key}`);
    return result.url;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw new Error('Failed to get signed URL');
  }
}
