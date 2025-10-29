const admin = require('firebase-admin');
const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// Initialize S3 Client
const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION || 'us-east-1',
});

const BUCKET_NAME = 'primeplus-firebase-hybrid-storage';

async function listAllS3Files() {
  const files = [];
  let continuationToken = undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);
    
    if (response.Contents) {
      files.push(...response.Contents.map(obj => obj.Key));
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

async function deleteFromS3(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
  console.log(`🗑️ Deleted: ${key}`);
}

async function cleanupStories() {
  console.log('\n=== Cleaning up STORIES ===');
  
  const s3Files = await listAllS3Files();
  const storyFiles = s3Files.filter(key => key.startsWith('stories/'));
  
  console.log(`Found ${storyFiles.length} story files in S3`);
  
  if (storyFiles.length > 0) {
    console.log(`Stories feature removed. Deleting all ${storyFiles.length} story files...`);
    
    for (const file of storyFiles) {
      await deleteFromS3(file);
    }
    
    return storyFiles.length;
  }
  
  return 0;
}

async function cleanupRecordings() {
  console.log('\n=== Cleaning up RECORDINGS ===');
  
  const s3Files = await listAllS3Files();
  const recordingFiles = s3Files.filter(key => key.startsWith('recordings/') && !key.endsWith('/'));
  
  console.log(`Found ${recordingFiles.length} recording files in S3`);
  
  if (recordingFiles.length > 0) {
    console.log(`No recordings feature. Deleting all ${recordingFiles.length} recording files...`);
    
    for (const file of recordingFiles) {
      await deleteFromS3(file);
    }
    
    return recordingFiles.length;
  }
  
  return 0;
}

async function main() {
  console.log('🚀 Starting S3 cleanup for orphaned files...\n');
  
  try {
    const storyCount = await cleanupStories();
    const recordingCount = await cleanupRecordings();
    
    console.log('\n✅ Cleanup complete!');
    console.log(`📊 Summary:`);
    console.log(`   - Story files deleted: ${storyCount}`);
    console.log(`   - Recording files deleted: ${recordingCount}`);
    console.log(`   - Total files deleted: ${storyCount + recordingCount}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
  
  process.exit(0);
}

main();
