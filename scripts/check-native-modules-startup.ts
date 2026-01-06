/**
 * Runtime Native Module Check
 * 
 * Add this to app/App.tsx to validate native modules are available at startup.
 * This catches registration issues before they cause runtime errors.
 * 
 * Usage:
 *   import { checkNativeModules } from '@/scripts/check-native-modules-startup';
 *   
 *   useEffect(() => {
 *     checkNativeModules();
 *   }, []);
 */

import { Platform, NativeModules, Alert } from 'react-native';

interface NativeModuleCheck {
  name: string;
  module: any;
  critical: boolean;
  description: string;
}

const REQUIRED_MODULES: NativeModuleCheck[] = [
  {
    name: 'AppMonitorModule',
    module: NativeModules.AppMonitorModule,
    critical: true,
    description: 'Core native module for app monitoring, interventions, and accessibility service',
  },
];

export function checkNativeModules(): void {
  if (Platform.OS !== 'android') {
    console.log('[NativeModules] Skipping validation (not Android)');
    return;
  }

  console.log('[NativeModules] 🔍 Validating native modules...\n');

  let allAvailable = true;
  let criticalMissing = false;

  REQUIRED_MODULES.forEach(({ name, module, critical, description }) => {
    if (!module) {
      const severity = critical ? '❌ CRITICAL' : '⚠️  WARNING';
      console.error(`${severity}: ${name} is not available`);
      console.error(`   ${description}`);
      console.error('');
      
      allAvailable = false;
      if (critical) {
        criticalMissing = true;
      }
    } else {
      console.log(`✅ ${name} is available`);
    }
  });

  if (!allAvailable) {
    const errorMessage = criticalMissing
      ? 'Critical native modules are missing. The app will not function correctly.'
      : 'Some native modules are missing. Some features may not work.';

    console.error(`\n❌ ${errorMessage}\n`);
    console.error('🔧 To fix:');
    console.error('   1. Stop the app');
    console.error('   2. Run: npx expo prebuild --clean');
    console.error('   3. Run: npm run android');
    console.error('   4. Check for plugin errors during prebuild');
    console.error('');

    if (__DEV__ && criticalMissing) {
      // Show alert in development mode
      Alert.alert(
        'Native Module Error',
        'Critical native modules are not registered. The app will not work correctly.\n\n' +
        'Please rebuild:\n' +
        '1. npx expo prebuild --clean\n' +
        '2. npm run android',
        [{ text: 'OK' }]
      );
    }
  } else {
    console.log('\n✅ All native modules are properly registered!\n');
  }
}

/**
 * Get detailed module information for debugging
 */
export function getNativeModuleInfo(): Record<string, boolean> {
  const info: Record<string, boolean> = {};
  
  REQUIRED_MODULES.forEach(({ name, module }) => {
    info[name] = !!module;
  });
  
  return info;
}

/**
 * Check if all critical modules are available
 */
export function areCriticalModulesAvailable(): boolean {
  return REQUIRED_MODULES
    .filter(m => m.critical)
    .every(m => !!m.module);
}
