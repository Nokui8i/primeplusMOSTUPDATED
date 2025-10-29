/**
 * CloudFront Cache Invalidation Script
 * 
 * This script invalidates CloudFront cache when files are deleted from S3.
 * Usage: node scripts/invalidate-cloudfront-cache.js <cloudfront-distribution-id> <path>
 * 
 * Example: node scripts/invalidate-cloudfront-cache.js E1234567890ABC /content/videos/*.mp4
 */

const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
require('dotenv').config();

async function invalidateCloudFrontCache(distributionId, paths) {
  const client = new CloudFrontClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    const command = new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        Paths: {
          Quantity: paths.length,
          Items: paths,
        },
        CallerReference: `invalidation-${Date.now()}`,
      },
    });

    const response = await client.send(command);
    console.log('✅ CloudFront cache invalidation created:', response.Invalidation?.Id);
    console.log('📊 Status:', response.Invalidation?.Status);
    return response;
  } catch (error) {
    console.error('❌ Error invalidating CloudFront cache:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const distributionId = process.argv[2] || process.env.CLOUDFRONT_DISTRIBUTION_ID;
  const pathPattern = process.argv[3] || '/*';
  
  if (!distributionId) {
    console.error('❌ Error: CloudFront Distribution ID required');
    console.log('Usage: node scripts/invalidate-cloudfront-cache.js <distribution-id> <path>');
    process.exit(1);
  }

  console.log(`🔄 Invalidating CloudFront cache for distribution: ${distributionId}`);
  console.log(`📁 Path: ${pathPattern}`);
  
  invalidateCloudFrontCache(distributionId, [pathPattern])
    .then(() => {
      console.log('✅ Invalidation complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to invalidate cache:', error);
      process.exit(1);
    });
}

module.exports = { invalidateCloudFrontCache };

