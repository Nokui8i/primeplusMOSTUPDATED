# Create backup directory with timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$backupDir = "backups/backup_$timestamp"
New-Item -ItemType Directory -Path $backupDir -Force

# List of important files to back up
$filesToBackup = @(
    "src",
    ".env.local",
    ".firebaserc",
    "firebase.json",
    "firestore.rules",
    "storage.rules",
    "next.config.js",
    "tailwind.config.js",
    "postcss.config.js",
    "tsconfig.json",
    "package.json",
    "package-lock.json",
    "next-env.d.ts",
    "README.md",
    "public",
    ".vscode",
    "CURSOR_RULES.md",
    "CURSOR_PROJECT_SPEC.md"
)

# Create backup info file
$backupInfo = @"
Backup created on: $(Get-Date -Format "MM/dd/yyyy HH:mm:ss")
Project: PrimePlus+

Files backed up:
$(($filesToBackup | ForEach-Object { "- $_" }) -join "`n")

Note: node_modules and .next directories are excluded as they can be reinstalled using 'npm install' and 'npm run build'
"@

Set-Content -Path "$backupDir/backup-info.txt" -Value $backupInfo

# Copy each file/directory to backup location
foreach ($item in $filesToBackup) {
    if (Test-Path $item) {
        Write-Host "Backing up $item..."
        if ((Get-Item $item) -is [System.IO.DirectoryInfo]) {
            Copy-Item $item -Destination "$backupDir/$item" -Recurse -Force
        } else {
            Copy-Item $item -Destination "$backupDir/$item" -Force
        }
    } else {
        Write-Warning "Warning: $item not found, skipping..."
    }
}

# Clean up old backups - keep only the 3 most recent
$allBackups = Get-ChildItem -Path "backups" -Directory | Where-Object { $_.Name -match "backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}" }
if ($allBackups.Count -gt 3) {
    $oldBackups = $allBackups | Sort-Object CreationTime -Descending | Select-Object -Skip 3
    foreach ($oldBackup in $oldBackups) {
        Write-Host "Removing old backup: $($oldBackup.Name)"
        Remove-Item $oldBackup.FullName -Recurse -Force
    }
}

Write-Host "`nBackup completed successfully!"
Write-Host "Location: $backupDir"
Write-Host "Maintaining 3 most recent backups only." 