const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../node_modules/@ffmpeg/core/dist');
const targetDir = path.join(__dirname, '../public/ffmpeg');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy core files
const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];
files.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`Copied ${file} to ${targetDir}`);
}); 