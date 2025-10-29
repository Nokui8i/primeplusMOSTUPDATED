# Clean up orphaned S3 files (stories, recordings that were deleted from the app but not from S3)

Write-Host "🧹 Starting orphaned S3 files cleanup..." -ForegroundColor Cyan

# Delete all story files (feature no longer exists)
Write-Host "`n=== Cleaning up STORIES ===" -ForegroundColor Yellow
$storyFiles = aws s3 ls s3://primeplus-firebase-hybrid-storage/stories/ --recursive | Select-String ".*\.\w+$"
if ($storyFiles) {
    $count = ($storyFiles | Measure-Object).Count
    Write-Host "Found $count story files. Deleting..." -ForegroundColor Yellow
    aws s3 rm s3://primeplus-firebase-hybrid-storage/stories/ --recursive
    Write-Host "✅ Deleted $count story files" -ForegroundColor Green
} else {
    Write-Host "No story files found" -ForegroundColor Gray
}

# Delete all recording files (feature no longer exists)
Write-Host "`n=== Cleaning up RECORDINGS ===" -ForegroundColor Yellow
$recordingFiles = aws s3 ls s3://primeplus-firebase-hybrid-storage/recordings/ --recursive | Select-String ".*\.\w+$"
if ($recordingFiles) {
    $count = ($recordingFiles | Measure-Object).Count
    Write-Host "Found $count recording files. Deleting..." -ForegroundColor Yellow
    aws s3 rm s3://primeplus-firebase-hybrid-storage/recordings/ --recursive
    Write-Host "✅ Deleted $count recording files" -ForegroundColor Green
} else {
    Write-Host "No recording files found" -ForegroundColor Gray
}

Write-Host "`n✅ Cleanup complete!" -ForegroundColor Green

