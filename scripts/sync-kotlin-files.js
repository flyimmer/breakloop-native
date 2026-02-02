#!/usr/bin/env node

/**
 * Sync Kotlin Plugin Files
 * 
 * Automatically copies Kotlin files from plugins/src/ to android/app/src/main/
 * before each build to ensure changes are always included.
 * 
 * This script runs automatically via npm prebuild hook.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

const KOTLIN_FILES = [
  'ForegroundDetectionService.kt',
  'AppMonitorModule.kt',
  'AppMonitorPackage.kt',
  'AppMonitorService.kt',
  'SystemSurfaceActivity.kt',
  'SystemBrainService.kt',
  'AppDiscoveryModule.kt',
  'AppDiscoveryPackage.kt',
  'NativeBuildCanary.kt',
  'SystemSurfaceManager.kt',
  'LogTags.kt',
  'QuickTaskQuotaStore.kt',
  'MonitoredAppsStore.kt',
  'DecisionGate.kt',
  'IntentionStore.kt',
  'SessionManager.kt',
];

function syncKotlinFiles() {
  console.log('🔄 Syncing Kotlin plugin files...\n');

  const sourcePath = path.join(PROJECT_ROOT, 'plugins', 'src', 'android', 'java', 'com', 'anonymous', 'breakloopnative');
  const destPath = path.join(PROJECT_ROOT, 'android', 'app', 'src', 'main', 'java', 'com', 'anonymous', 'breakloopnative');

  // Check if android directory exists
  if (!fs.existsSync(destPath)) {
    console.log('⚠️  Android directory not found. Run "npx expo prebuild" first.');
    return;
  }

  let syncedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const fileName of KOTLIN_FILES) {
    const sourceFile = path.join(sourcePath, fileName);
    const destFile = path.join(destPath, fileName);

    try {
      if (!fs.existsSync(sourceFile)) {
        console.log(`⚠️  ${fileName} - Source not found, skipping`);
        skippedCount++;
        continue;
      }

      // Check if files are different
      if (fs.existsSync(destFile)) {
        const sourceContent = fs.readFileSync(sourceFile, 'utf-8');
        const destContent = fs.readFileSync(destFile, 'utf-8');

        if (sourceContent === destContent) {
          console.log(`✓  ${fileName} - Already up to date`);
          skippedCount++;
          continue;
        }
      }

      // Copy file
      fs.copyFileSync(sourceFile, destFile);
      console.log(`✅ ${fileName} - Synced`);
      syncedCount++;

    } catch (error) {
      console.error(`❌ ${fileName} - Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary: ${syncedCount} synced, ${skippedCount} skipped, ${errorCount} errors\n`);

  if (syncedCount > 0) {
    console.log('✨ Kotlin files synced successfully!\n');
  }
}

// Run sync
syncKotlinFiles();

