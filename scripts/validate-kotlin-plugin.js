#!/usr/bin/env node

/**
 * Validation Script: Check if all Kotlin files in plugins/src are included in plugin
 * 
 * This script ensures that when new Kotlin files are added to plugins/src/,
 * they are also added to plugins/withForegroundService.js so they get copied
 * during build.
 * 
 * Run this before committing or building:
 *   node scripts/validate-kotlin-plugin.js
 * 
 * Or add to package.json:
 *   "scripts": {
 *     "validate:kotlin": "node scripts/validate-kotlin-plugin.js"
 *   }
 */

const fs = require('fs');
const path = require('path');

const PLUGIN_FILE = path.join(__dirname, '..', 'plugins', 'withForegroundService.js');
const PLUGIN_SRC_DIR = path.join(__dirname, '..', 'plugins', 'src', 'android', 'java', 'com', 'anonymous', 'breakloopnative');

// Kotlin files that should be copied by plugin
const REQUIRED_KOTLIN_FILES = [
  'ForegroundDetectionService.kt',
  'InterventionActivity.kt',
  'AppMonitorModule.kt',
  'AppMonitorPackage.kt',
  'AppMonitorService.kt',
];

// Files that are native-only (not in plugin, safe to ignore)
const NATIVE_ONLY_FILES = [
  'MainActivity.kt',  // Only exists in android/app/, not in plugin
];

function getExistingKotlinFiles() {
  if (!fs.existsSync(PLUGIN_SRC_DIR)) {
    return [];
  }
  
  return fs.readdirSync(PLUGIN_SRC_DIR)
    .filter(file => file.endsWith('.kt'))
    .filter(file => !NATIVE_ONLY_FILES.includes(file));
}

function checkPluginIncludesFile(pluginContent, fileName) {
  // Check if file is referenced in getSourcePaths() or getDestinationPaths()
  // Look for the filename in path.join() calls (e.g., path.join(javaPath, 'FileName.kt'))
  const fileNameEscaped = fileName.replace(/\./g, '\\.');
  const pathPattern = new RegExp(`['"]${fileNameEscaped}['"]`, 'g');
  if (!pathPattern.test(pluginContent)) {
    return false;
  }
  
  // Check if file is copied in copyKotlinFiles()
  // Look for copyFileSync with sourcePaths or destPaths variable
  // OR look for the filename in console.log (e.g., "Copied FileName.kt")
  const copyPattern1 = new RegExp(`copyFileSync.*sourcePaths\\..*${fileNameEscaped}`, 'g');
  const copyPattern2 = new RegExp(`copyFileSync.*destPaths\\..*${fileNameEscaped}`, 'g');
  const logPattern = new RegExp(`Copied.*${fileNameEscaped}`, 'g');
  
  if (!copyPattern1.test(pluginContent) && !copyPattern2.test(pluginContent) && !logPattern.test(pluginContent)) {
    return false;
  }
  
  return true;
}

function main() {
  console.log('🔍 Validating Kotlin plugin configuration...\n');
  
  // Read plugin file
  if (!fs.existsSync(PLUGIN_FILE)) {
    console.error('❌ Plugin file not found:', PLUGIN_FILE);
    process.exit(1);
  }
  
  const pluginContent = fs.readFileSync(PLUGIN_FILE, 'utf-8');
  
  // Get all Kotlin files in plugin source directory
  const existingFiles = getExistingKotlinFiles();
  
  if (existingFiles.length === 0) {
    console.warn('⚠️  No Kotlin files found in plugin source directory');
    console.log('   Directory:', PLUGIN_SRC_DIR);
    process.exit(0);
  }
  
  console.log(`📁 Found ${existingFiles.length} Kotlin file(s) in plugin source:\n`);
  
  let hasErrors = false;
  const missingFiles = [];
  
  // Check each file
  for (const file of existingFiles) {
    const isIncluded = checkPluginIncludesFile(pluginContent, file);
    
    if (isIncluded) {
      console.log(`   ✅ ${file} - Included in plugin`);
    } else {
      console.log(`   ❌ ${file} - NOT included in plugin!`);
      missingFiles.push(file);
      hasErrors = true;
    }
  }
  
  console.log('');
  
  if (hasErrors) {
    console.error('❌ VALIDATION FAILED!\n');
    console.error('The following files are in plugins/src/ but NOT in the plugin configuration:');
    missingFiles.forEach(file => console.error(`   - ${file}`));
    console.error('');
    console.error('📝 To fix this:');
    console.error('   1. Open plugins/withForegroundService.js');
    console.error('   2. Add the file to getSourcePaths()');
    console.error('   3. Add the file to getDestinationPaths()');
    console.error('   4. Add copyFileSync() call in copyKotlinFiles()');
    console.error('');
    console.error('See docs/KOTLIN_FILE_WORKFLOW.md for detailed instructions.');
    process.exit(1);
  }
  
  console.log('✅ All Kotlin files are properly configured in plugin!');
  console.log('');
  console.log('💡 Tip: Run this script before committing to catch missing files early.');
  process.exit(0);
}

main();

