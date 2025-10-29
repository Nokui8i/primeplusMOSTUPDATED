import { NextRequest, NextResponse } from 'next/server';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

// Configure AWS S3
const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  region: process.env.AWS_REGION || 'us-east-1',
});

const cloudfrontClient = new CloudFrontClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'primeplus-firebase-hybrid-storage';

export async function DELETE(request: NextRequest) {
  try {
    const { key } = await request.json();

    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    }

    console.log(`🗑️ Deleting S3 object: ${key}`);

    // Delete from S3 using modern SDK
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`✅ S3 object deleted: ${key}`);

    // Invalidate CloudFront cache for this file
    const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
    if (distributionId) {
      try {
        console.log(`🔄 Invalidating CloudFront cache for: ${key}`);
        
        const invalidationCommand = new CreateInvalidationCommand({
          DistributionId: distributionId,
          InvalidationBatch: {
            Paths: {
              Quantity: 1,
              Items: [`/${key}`], // CloudFront paths must start with /
            },
            CallerReference: `invalidation-${Date.now()}-${key}`,
          },
        });

        await cloudfrontClient.send(invalidationCommand);
        console.log(`✅ CloudFront cache invalidated for: ${key}`);
      } catch (cfError: any) {
        console.warn(`⚠️ Failed to invalidate CloudFront cache: ${cfError.message}`);
        // Don't fail the delete if cache invalidation fails
      }
    } else {
      console.warn(`⚠️ CloudFront Distribution ID not configured, skipping cache invalidation`);
    }

    return NextResponse.json({ success: true, message: 'File deleted and cache invalidated' });
  } catch (error) {
    console.error('❌ Error deleting from S3:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
