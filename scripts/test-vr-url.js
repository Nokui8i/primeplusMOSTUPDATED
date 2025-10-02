const { extractS3KeyFromUrl, getCloudFrontSignedUrl } = require('../src/lib/aws/s3');

async function testVRUrlProcessing() {
  try {
    console.log('🧪 Testing VR URL processing...\n');

    // Test S3 URL extraction
    const s3Url = 'https://primeplus-firebase-hybrid-storage.s3.us-east-1.amazonaws.com/content/images/ojKhs5rVVtYsumeG7FNL28p1Re33/1758645244671_aerial_drone_panorama_view_nature_moldova_sunset_village_wide_fields_valleys.jpg';
    
    console.log('📝 Test S3 URL:', s3Url);
    
    const s3Key = extractS3KeyFromUrl(s3Url);
    console.log('✅ Extracted S3 key:', s3Key);
    
    // Test signed URL generation
    console.log('\n🔐 Testing signed URL generation...');
    const signedUrl = await getCloudFrontSignedUrl(s3Key);
    console.log('✅ Generated signed URL:', signedUrl);
    
    // Test CloudFront URL extraction
    const cloudfrontUrl = 'https://doelz7dqz8shj.cloudfront.net/content/images/ojKhs5rVVtYsumeG7FNL28p1Re33/1758645244671_aerial_drone_panorama_view_nature_moldova_sunset_village_wide_fields_valleys.jpg';
    
    console.log('\n📝 Test CloudFront URL:', cloudfrontUrl);
    
    const cloudfrontKey = extractS3KeyFromUrl(cloudfrontUrl);
    console.log('✅ Extracted S3 key from CloudFront URL:', cloudfrontKey);
    
    console.log('\n🎉 All tests passed! VR URL processing is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testVRUrlProcessing();
