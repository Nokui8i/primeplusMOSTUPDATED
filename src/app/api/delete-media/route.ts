import { NextRequest, NextResponse } from 'next/server';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json();

    console.log('[delete-media] Request received for key:', key);
    console.log('[delete-media] AWS Config:', {
      region: process.env.AWS_REGION,
      bucket: process.env.AWS_S3_BUCKET_NAME,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
    });

    if (!key) {
      return NextResponse.json(
        { error: 'S3 key is required' },
        { status: 400 }
      );
    }

    console.log('[delete-media] Deleting from S3:', key);

    const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || '';
    
    if (!bucketName) {
      console.error('[delete-media] No S3 bucket configured');
      return NextResponse.json(
        { error: 'S3 bucket not configured' },
        { status: 500 }
      );
    }

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);

    console.log('[delete-media] Successfully deleted from S3:', key);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[delete-media] Error deleting from S3:', error);
    console.error('[delete-media] Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode
    });
    return NextResponse.json(
      { 
        error: 'Failed to delete media',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}

