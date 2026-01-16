#!/usr/bin/env node

/**
 * Validate Native Module Registration
 * 
 * Checks that all required native modules are properly registered in MainApplication.kt
 * Run this before building to catch missing registrations early.
 * 
 * Usage:
 *   node scripts/validate-native-modules.js
 *   npm run validate:native
 */

const fs = require('fs');
const path = require('path');

const mainApplicationPath = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'anonymous',
  'breakloopnative',
  'MainApplication.kt'
);

console.log('🔍 Validating native module registration...\n');

// Check if android directory exists
if (!fs.existsSync(mainApplicationPath)) {
  console.error('❌ MainApplication.kt not found.');
  console.error('   Path:', mainApplicationPath);
  console.error('\n💡 Run `npx expo prebuild` first to generate the android directory.\n');
  process.exit(1);
}

const content = fs.readFileSync(mainApplicationPath, 'utf-8');

// List of required native module packages
const requiredPackages = [
  {
    name: 'AppMonitorPackage',
    registration: 'add(AppMonitorPackage())',
    description: 'Core native module for app monitoring and interventions',
  },
  {
    name: 'AppDiscoveryPackage',
    registration: 'add(AppDiscoveryPackage())',
    description: 'Multi-source app discovery (launcher, UsageStats, accessibility)',
  },
];

let allRegistered = true;
let registeredCount = 0;

console.log('Checking required packages:\n');

requiredPackages.forEach(pkg => {
  if (!content.includes(pkg.registration)) {
    console.error(`❌ ${pkg.name}`);
    console.error(`   Missing: ${pkg.registration}`);
    console.error(`   Purpose: ${pkg.description}`);
    console.error('');
    allRegistered = false;
  } else {
    console.log(`✅ ${pkg.name}`);
    console.log(`   ${pkg.description}`);
    console.log('');
    registeredCount++;
  }
});

// Summary
console.log('─'.repeat(60));
console.log(`📊 Summary: ${registeredCount}/${requiredPackages.length} packages registered\n`);

if (!allRegistered) {
  console.error('❌ Native module validation failed!\n');
  console.error('🔧 To fix:');
  console.error('   1. Run: npx expo prebuild --clean');
  console.error('   2. Check that plugins/withForegroundService.js is working correctly');
  console.error('   3. Verify the plugin logs show: "✅ Registered AppMonitorPackage"');
  console.error('');
  process.exit(1);
}

console.log('✅ All native modules are properly registered!\n');
process.exit(0);
