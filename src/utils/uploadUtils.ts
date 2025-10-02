// Firebase Storage imports removed - now using AWS S3

export const uploadFile = async (
  file: File,
  folder: string,
  customPath?: string
): Promise<string> => {
  try {
    const { uploadToS3, generateS3Key } = await import('@/lib/aws/s3');
    
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
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const s3Key = customPath || `${folder}/${fileName}`;
    
    // Upload to AWS S3
    const downloadURL = await uploadToS3(file, s3Key);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file');
  }
}; 