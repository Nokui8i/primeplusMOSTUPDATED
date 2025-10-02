import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';

export const runtime = 'nodejs'; // Ensure this runs in Node.js environment

// Configure S3 client as fallback
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    console.log('🔐 CloudFront signed URL request for key:', key);

    const CLOUDFRONT_DOMAIN = process.env.AWS_CLOUDFRONT_DOMAIN || 'doelz7dqz8shj.cloudfront.net';
    const KEY_PAIR_ID = process.env.CLOUDFRONT_KEY_PAIR_ID;
    const PRIVATE_KEY = process.env.CLOUDFRONT_PRIVATE_KEY?.replace(/\\n/g, '\n');

    // Try CloudFront signed URL first
    if (KEY_PAIR_ID && PRIVATE_KEY) {
      try {
        const url = `https://${CLOUDFRONT_DOMAIN}/${key}`;
        
        const signedUrl = getSignedUrl({
          url,
          keyPairId: KEY_PAIR_ID,
          privateKey: PRIVATE_KEY,
          dateLessThan: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
        });

        return NextResponse.json({ 
          url: signedUrl,
          expiresIn: 3600,
          type: 'cloudfront'
        });
      } catch (cloudfrontError) {
        console.warn('CloudFront signed URL failed, falling back to S3:', cloudfrontError);
      }
    } else {
      console.warn('CloudFront credentials not configured, using S3 signed URL');
    }

    // Fallback to S3 signed URL
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME || 'primeplus-firebase-hybrid-storage',
      Key: key,
    });

    const signedUrl = await getS3SignedUrl(s3Client, command, { expiresIn: 3600 });

    return NextResponse.json({ 
      url: signedUrl,
      expiresIn: 3600,
      type: 's3'
    });
  } catch (error) {
    console.error('Error creating signed URL:', error);
    return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 });
  }
}
