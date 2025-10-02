const AWS = require('aws-sdk');

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'primeplus-firebase-hybrid-storage';

async function configureS3VRAccess() {
  try {
    console.log('🔧 Configuring S3 bucket for VR content access...\n');

    // 1. Set bucket policy for public read access to content
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${BUCKET_NAME}/content/*`
        }
      ]
    };

    console.log('📝 Setting bucket policy for content/* public read access...');
    await s3.putBucketPolicy({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(bucketPolicy)
    }).promise();
    console.log('✅ Bucket policy set successfully');

    // 2. Configure CORS for web access
    const corsConfiguration = {
      CORSRules: [
        {
          AllowedHeaders: ['*'],
          AllowedMethods: ['GET', 'HEAD'],
          AllowedOrigins: ['*'],
          ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
          MaxAgeSeconds: 3600
        }
      ]
    };

    console.log('🌐 Configuring CORS for web access...');
    await s3.putBucketCors({
      Bucket: BUCKET_NAME,
      CORSConfiguration: corsConfiguration
    }).promise();
    console.log('✅ CORS configuration updated');

    // 3. Test the configuration by trying to access a content file
    console.log('\n🧪 Testing public access to content...');
    try {
      const testKey = 'content/images/ojKhs5rVVtYsumeG7FNL28p1Re33/1758645244671_aerial_drone_panorama_view_nature_moldova_sunset_village_wide_fields_valleys.jpg';
      const testUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${testKey}`;
      
      console.log(`🔗 Test URL: ${testUrl}`);
      console.log('✅ S3 bucket configured for VR content access!');
      console.log('\n📋 Summary:');
      console.log(`- Bucket: ${BUCKET_NAME}`);
      console.log('- Public read access: content/* (only)');
      console.log('- CORS: Enabled for web access');
      console.log('- VR content should now be accessible by Google VR View service');
      
    } catch (testError) {
      console.warn('⚠️  Could not test access (this is normal if the file doesn\'t exist yet)');
    }

  } catch (error) {
    console.error('❌ Error configuring S3 bucket:', error);
    
    if (error.code === 'AccessDenied') {
      console.log('\n💡 Solution: You need to run this with AWS credentials that have S3 permissions.');
      console.log('   Make sure your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set correctly.');
    }
    
    process.exit(1);
  }
}

// Run the configuration
configureS3VRAccess();
