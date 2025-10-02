const loadEnv = require('./loadEnv');
const { updateExistingCommentsDisplayNames } = require('../src/lib/firebase/migrations/updateCommentDisplayNames');

// Load environment variables
loadEnv();

async function runMigration() {
  try {
    console.log('Starting comment display names migration...');
    const result = await updateExistingCommentsDisplayNames();
    console.log('Migration completed successfully!');
    console.log(`Total comments processed: ${result.totalComments}`);
    console.log(`Comments updated: ${result.updatedComments}`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration(); 