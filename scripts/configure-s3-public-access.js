const AWS = require('aws-sdk');

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'primeplus-firebase-hybrid-storage';

async function configureS3PublicAccess() {
  try {
    console.log('Configuring S3 bucket for public read access...');

    // 1. Set bucket policy for public read access
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${BUCKET_NAME}/*`
        }
      ]
    };

    await s3.putBucketPolicy({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(bucketPolicy)
    }).promise();

    console.log('✅ Bucket policy set for public read access');

    // 2. Configure CORS
    const corsConfiguration = {
      CORSRules: [
        {
          AllowedHeaders: ['*'],
          AllowedMethods: ['GET', 'HEAD'],
          AllowedOrigins: ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3600
        }
      ]
    };

    await s3.putBucketCors({
      Bucket: BUCKET_NAME,
      CORSConfiguration: corsConfiguration
    }).promise();

    console.log('✅ CORS configuration updated');

    // 3. Set bucket ACL to public-read
    await s3.putBucketAcl({
      Bucket: BUCKET_NAME,
      ACL: 'public-read'
    }).promise();

    console.log('✅ Bucket ACL set to public-read');

    // 4. Set default object ACL to public-read
    await s3.putBucketAcl({
      Bucket: BUCKET_NAME,
      ACL: 'public-read'
    }).promise();

    console.log('✅ Default object ACL set to public-read');

    console.log('\n🎉 S3 bucket configured successfully for public read access!');
    console.log(`Bucket: ${BUCKET_NAME}`);
    console.log('VR content should now be accessible by Google VR View service.');

  } catch (error) {
    console.error('❌ Error configuring S3 bucket:', error);
    process.exit(1);
  }
}

// Run the configuration
configureS3PublicAccess();
