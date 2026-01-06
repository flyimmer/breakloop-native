const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withStringsXml, withDangerousMod } = require('@expo/config-plugins');

/**
 * Expo Config Plugin: withForegroundService
 * 
 * Automatically configures the ForegroundDetectionService (AccessibilityService)
 * and InterventionActivity for BreakLoop's Android foreground app detection and intervention.
 * 
 * PHASE F3.5 ADDITIONS:
 * - Copies InterventionActivity.kt (dedicated intervention UI activity)
 * - Copies AppMonitorModule.kt (with Phase F3.5 methods)
 * - Copies AppMonitorPackage.kt (native module package registration)
 * - Copies AppMonitorService.kt (service stub with React context)
 * - Merges styles.xml (adds Theme.Intervention)
 * - Registers InterventionActivity in AndroidManifest.xml
 * 
 * What this plugin does:
 * 1. Copies ForegroundDetectionService.kt to the correct Android directory
 * 2. Copies InterventionActivity.kt (Phase F3.5)
 * 3. Copies AppMonitorModule.kt (Phase F3.5)
 * 4. Copies AppMonitorPackage.kt (native module package)
 * 5. Copies AppMonitorService.kt (service stub)
 * 4. Adds BIND_ACCESSIBILITY_SERVICE permission to AndroidManifest.xml
 * 5. Registers the AccessibilityService in AndroidManifest.xml
 * 6. Registers InterventionActivity in AndroidManifest.xml (Phase F3.5)
 * 7. Copies accessibility_service.xml to res/xml/
 * 8. Adds accessibility_service_description string to res/values/strings.xml
 * 9. Merges Theme.Intervention style into res/values/styles.xml (Phase F3.5)
 * 
 * Usage in app.json:
 * {
 *   "expo": {
 *     "plugins": [
 *       "./plugins/withForegroundService.js"
 *     ]
 *   }
 * }
 */

const PLUGIN_NAME = 'withForegroundService';

/**
 * Get the source file paths (from plugins/src/)
 */
function getSourcePaths(projectRoot) {
  const pluginSrcPath = path.join(projectRoot, 'plugins', 'src', 'android');
  const javaPath = path.join(pluginSrcPath, 'java', 'com', 'anonymous', 'breakloopnative');
  return {
    foregroundService: path.join(javaPath, 'ForegroundDetectionService.kt'),
    appMonitorModule: path.join(javaPath, 'AppMonitorModule.kt'),
    appMonitorPackage: path.join(javaPath, 'AppMonitorPackage.kt'),
    appMonitorService: path.join(javaPath, 'AppMonitorService.kt'),
    systemSurfaceActivity: path.join(javaPath, 'SystemSurfaceActivity.kt'),
    systemBrainService: path.join(javaPath, 'SystemBrainService.kt'),
    accessibilityXml: path.join(pluginSrcPath, 'res', 'xml', 'accessibility_service.xml'),
    stringsXml: path.join(pluginSrcPath, 'res', 'values', 'strings.xml'),
    stylesXml: path.join(pluginSrcPath, 'res', 'values', 'styles.xml'),
  };
}

/**
 * Get the destination file paths (in android/app/src/main/)
 */
function getDestinationPaths(projectRoot) {
  const androidMainPath = path.join(projectRoot, 'android', 'app', 'src', 'main');
  const javaPath = path.join(androidMainPath, 'java', 'com', 'anonymous', 'breakloopnative');
  return {
    foregroundService: path.join(javaPath, 'ForegroundDetectionService.kt'),
    appMonitorModule: path.join(javaPath, 'AppMonitorModule.kt'),
    appMonitorPackage: path.join(javaPath, 'AppMonitorPackage.kt'),
    appMonitorService: path.join(javaPath, 'AppMonitorService.kt'),
    systemSurfaceActivity: path.join(javaPath, 'SystemSurfaceActivity.kt'),
    systemBrainService: path.join(javaPath, 'SystemBrainService.kt'),
    accessibilityXml: path.join(androidMainPath, 'res', 'xml', 'accessibility_service.xml'),
  };
}

/**
 * Copy Kotlin files to Android directory
 */
function copyKotlinFiles(projectRoot) {
  const sourcePaths = getSourcePaths(projectRoot);
  const destPaths = getDestinationPaths(projectRoot);
  
  // Ensure destination directory exists
  const destDir = path.dirname(destPaths.foregroundService);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Copy ForegroundDetectionService.kt
  if (fs.existsSync(sourcePaths.foregroundService)) {
    fs.copyFileSync(sourcePaths.foregroundService, destPaths.foregroundService);
    console.log(`[${PLUGIN_NAME}] Copied ForegroundDetectionService.kt`);
  } else {
    throw new Error(`[${PLUGIN_NAME}] Source file not found: ${sourcePaths.foregroundService}`);
  }
  
  
  // Copy AppMonitorModule.kt (Phase F3.5)
  if (fs.existsSync(sourcePaths.appMonitorModule)) {
    fs.copyFileSync(sourcePaths.appMonitorModule, destPaths.appMonitorModule);
    console.log(`[${PLUGIN_NAME}] Copied AppMonitorModule.kt`);
  } else {
    throw new Error(`[${PLUGIN_NAME}] Source file not found: ${sourcePaths.appMonitorModule}`);
  }
  
  // Copy AppMonitorPackage.kt
  if (fs.existsSync(sourcePaths.appMonitorPackage)) {
    fs.copyFileSync(sourcePaths.appMonitorPackage, destPaths.appMonitorPackage);
    console.log(`[${PLUGIN_NAME}] Copied AppMonitorPackage.kt`);
  } else {
    console.warn(`[${PLUGIN_NAME}] AppMonitorPackage.kt not found, skipping (optional)`);
  }
  
  // Copy AppMonitorService.kt
  if (fs.existsSync(sourcePaths.appMonitorService)) {
    fs.copyFileSync(sourcePaths.appMonitorService, destPaths.appMonitorService);
    console.log(`[${PLUGIN_NAME}] Copied AppMonitorService.kt`);
  } else {
    console.warn(`[${PLUGIN_NAME}] AppMonitorService.kt not found, skipping (optional)`);
  }
  
  // Copy SystemSurfaceActivity.kt
  if (fs.existsSync(sourcePaths.systemSurfaceActivity)) {
    fs.copyFileSync(sourcePaths.systemSurfaceActivity, destPaths.systemSurfaceActivity);
    console.log(`[${PLUGIN_NAME}] Copied SystemSurfaceActivity.kt`);
  } else {
    console.warn(`[${PLUGIN_NAME}] SystemSurfaceActivity.kt not found, skipping (optional)`);
  }
  
  // Copy SystemBrainService.kt
  if (fs.existsSync(sourcePaths.systemBrainService)) {
    fs.copyFileSync(sourcePaths.systemBrainService, destPaths.systemBrainService);
    console.log(`[${PLUGIN_NAME}] Copied SystemBrainService.kt`);
  } else {
    console.warn(`[${PLUGIN_NAME}] SystemBrainService.kt not found, skipping (optional)`);
  }
}

/**
 * Modify MainApplication.kt to register AppMonitorPackage
 */
function registerAppMonitorPackage(projectRoot) {
  const mainApplicationPath = path.join(
    projectRoot,
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
  
  if (!fs.existsSync(mainApplicationPath)) {
    console.warn(`[${PLUGIN_NAME}] MainApplication.kt not found, skipping package registration`);
    return;
  }
  
  let content = fs.readFileSync(mainApplicationPath, 'utf-8');
  
  // Check if already registered
  if (content.includes('add(AppMonitorPackage())')) {
    console.log(`[${PLUGIN_NAME}] AppMonitorPackage already registered in MainApplication.kt`);
    return;
  }
  
  // Find the closing brace of the apply block and add the package before it
  // Pattern: PackageList(this).packages.apply { ... }
  const applyBlockPattern = /(PackageList\(this\)\.packages\.apply\s*\{[\s\S]*?)(            \})/;
  
  if (applyBlockPattern.test(content)) {
    content = content.replace(
      applyBlockPattern,
      '$1              add(AppMonitorPackage())\n$2'
    );
    
    fs.writeFileSync(mainApplicationPath, content);
    console.log(`[${PLUGIN_NAME}] ✅ Registered AppMonitorPackage in MainApplication.kt`);
  } else {
    console.warn(`[${PLUGIN_NAME}] Could not find package registration location in MainApplication.kt`);
    console.warn(`[${PLUGIN_NAME}] Please manually add: add(AppMonitorPackage()) to getPackages() in MainApplication.kt`);
  }
}

/**
 * Copy accessibility_service.xml to res/xml/
 */
function copyAccessibilityXml(projectRoot) {
  const { accessibilityXml: sourcePath } = getSourcePaths(projectRoot);
  const { accessibilityXml: destPath } = getDestinationPaths(projectRoot);
  
  // Ensure destination directory exists
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Copy file
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`[${PLUGIN_NAME}] Copied accessibility_service.xml`);
  } else {
    throw new Error(`[${PLUGIN_NAME}] Source file not found: ${sourcePath}`);
  }
}

/**
 * Modify AndroidManifest.xml to add permission, service, and activity
 */
function withAndroidManifestModifications(config) {
  return withAndroidManifest(config, async (config) => {
    const { modResults } = config;
    const { manifest } = modResults;
    
    // Ensure manifest exists
    if (!manifest) {
      throw new Error('[withForegroundService] AndroidManifest.xml not found');
    }
    
    // Add required permissions
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    
    const permissions = Array.isArray(manifest['uses-permission'])
      ? manifest['uses-permission']
      : [manifest['uses-permission']];
    
    // Add BIND_ACCESSIBILITY_SERVICE permission
    const hasAccessibilityPermission = permissions.some(
      (perm) => perm.$['android:name'] === 'android.permission.BIND_ACCESSIBILITY_SERVICE'
    );
    
    if (!hasAccessibilityPermission) {
      permissions.push({
        $: {
          'android:name': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          'tools:ignore': 'ProtectedPermissions',
        },
      });
      console.log(`[${PLUGIN_NAME}] Added BIND_ACCESSIBILITY_SERVICE permission`);
    }
    
    // Add WAKE_LOCK permission (required for HeadlessTaskService)
    const hasWakeLockPermission = permissions.some(
      (perm) => perm.$['android:name'] === 'android.permission.WAKE_LOCK'
    );
    
    if (!hasWakeLockPermission) {
      permissions.push({
        $: {
          'android:name': 'android.permission.WAKE_LOCK',
        },
      });
      console.log(`[${PLUGIN_NAME}] Added WAKE_LOCK permission`);
    }
    
    manifest['uses-permission'] = permissions;
    
    // Add AccessibilityService and InterventionActivity to application
    if (!manifest.application) {
      throw new Error('[withForegroundService] <application> tag not found in AndroidManifest.xml');
    }
    
    const application = Array.isArray(manifest.application) ? manifest.application[0] : manifest.application;
    
    // Register ForegroundDetectionService
    if (!application.service) {
      application.service = [];
    }
    
    const services = Array.isArray(application.service) ? application.service : [application.service];
    
    const hasService = services.some(
      (service) => service.$['android:name'] === '.ForegroundDetectionService'
    );
    
    if (!hasService) {
      services.push({
        $: {
          'android:name': '.ForegroundDetectionService',
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          'android:exported': 'true',
          'android:enabled': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.accessibilityservice.AccessibilityService',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.accessibilityservice',
              'android:resource': '@xml/accessibility_service',
            },
          },
        ],
      });
      console.log(`[${PLUGIN_NAME}] Registered ForegroundDetectionService in AndroidManifest.xml`);
    }
    
    // Register SystemBrainService (HeadlessTaskService for System Brain JS)
    const hasSystemBrainService = services.some(
      (service) => service.$['android:name'] === '.SystemBrainService'
    );
    
    if (!hasSystemBrainService) {
      services.push({
        $: {
          'android:name': '.SystemBrainService',
          'android:exported': 'false',
        },
      });
      console.log(`[${PLUGIN_NAME}] Registered SystemBrainService in AndroidManifest.xml`);
    }
    
    application.service = services;
    
    // Register SystemSurfaceActivity
    if (!application.activity) {
      application.activity = [];
    }
    
    const activities = Array.isArray(application.activity) ? application.activity : [application.activity];
    
    const hasSystemSurfaceActivity = activities.some(
      (activity) => activity.$['android:name'] === '.SystemSurfaceActivity'
    );
    
    if (!hasSystemSurfaceActivity) {
      activities.push({
        $: {
          'android:name': '.SystemSurfaceActivity',
          'android:configChanges': 'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode',
          'android:launchMode': 'singleInstance',
          'android:excludeFromRecents': 'true',
          'android:taskAffinity': '',
          'android:theme': '@style/Theme.Intervention',
          'android:exported': 'false',
          'android:windowSoftInputMode': 'adjustResize',
          'android:screenOrientation': 'portrait',
        },
      });
      application.activity = activities;
      console.log(`[${PLUGIN_NAME}] Registered SystemSurfaceActivity in AndroidManifest.xml`);
    }
    
    return config;
  });
}

/**
 * Merge strings.xml to add accessibility_service_description
 */
function withStringsXmlModifications(config) {
  return withStringsXml(config, async (config) => {
    const { modResults } = config;
    
    // Read source strings.xml
    const { stringsXml: sourcePath } = getSourcePaths(config.modRequest.projectRoot);
    
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`[${PLUGIN_NAME}] Source strings.xml not found: ${sourcePath}`);
    }
    
    // Parse source XML
    const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
    const sourceMatch = sourceContent.match(/<string name="accessibility_service_description">(.*?)<\/string>/);
    
    if (!sourceMatch) {
      throw new Error('[withForegroundService] Could not find accessibility_service_description in source strings.xml');
    }
    
    // Add or update the string in modResults
    if (!modResults.resources) {
      modResults.resources = {};
    }
    if (!modResults.resources.string) {
      modResults.resources.string = [];
    }
    
    const strings = Array.isArray(modResults.resources.string)
      ? modResults.resources.string
      : [modResults.resources.string];
    
    // Check if string already exists
    const existingIndex = strings.findIndex(
      (str) => str.$.name === 'accessibility_service_description'
    );
    
    const newString = {
      $: {
        name: 'accessibility_service_description',
      },
      _: sourceMatch[1],
    };
    
    if (existingIndex >= 0) {
      strings[existingIndex] = newString;
      console.log(`[${PLUGIN_NAME}] Updated accessibility_service_description in strings.xml`);
    } else {
      strings.push(newString);
      console.log(`[${PLUGIN_NAME}] Added accessibility_service_description to strings.xml`);
    }
    
    modResults.resources.string = strings;
    
    return config;
  });
}

/**
 * Merge styles.xml to add Theme.Intervention (Phase F3.5)
 */
function withStylesXmlModifications(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const sourceStylesPath = getSourcePaths(projectRoot).stylesXml;
      const destStylesPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml');
      
      if (!fs.existsSync(sourceStylesPath)) {
        console.warn(`[${PLUGIN_NAME}] Source styles.xml not found, skipping Theme.Intervention merge`);
        return config;
      }
      
      // Read source Theme.Intervention
      const sourceContent = fs.readFileSync(sourceStylesPath, 'utf-8');
      const themeMatch = sourceContent.match(/<style name="Theme\.Intervention"[^>]*>([\s\S]*?)<\/style>/);
      
      if (!themeMatch) {
        console.warn(`[${PLUGIN_NAME}] Theme.Intervention not found in source styles.xml`);
        return config;
      }
      
      // Read destination styles.xml
      if (!fs.existsSync(destStylesPath)) {
        console.warn(`[${PLUGIN_NAME}] Destination styles.xml not found, creating new file`);
        fs.writeFileSync(destStylesPath, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${themeMatch[0]}\n</resources>\n`);
        console.log(`[${PLUGIN_NAME}] Created styles.xml with Theme.Intervention`);
        return config;
      }
      
      // Check if Theme.Intervention already exists
      const destContent = fs.readFileSync(destStylesPath, 'utf-8');
      if (destContent.includes('name="Theme.Intervention"')) {
        console.log(`[${PLUGIN_NAME}] Theme.Intervention already exists in styles.xml`);
        return config;
      }
      
      // Append Theme.Intervention before closing </resources>
      const updatedContent = destContent.replace(
        '</resources>',
        `  ${themeMatch[0]}\n</resources>`
      );
      
      fs.writeFileSync(destStylesPath, updatedContent);
      console.log(`[${PLUGIN_NAME}] Added Theme.Intervention to styles.xml`);
      
      return config;
    },
  ]);
}

/**
 * Main plugin function
 * Chains file copying with config modifications
 */
const withForegroundService = (config) => {
  // Step 1: Copy Kotlin files and XML files using withDangerousMod (runs during prebuild)
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      
      // Copy files
      copyKotlinFiles(projectRoot);
      copyAccessibilityXml(projectRoot);
      
      // Register AppMonitorPackage in MainApplication.kt
      registerAppMonitorPackage(projectRoot);
      
      return config;
    },
  ]);
  
  // Step 2: Modify AndroidManifest.xml (permission + service + activity)
  config = withAndroidManifestModifications(config);
  
  // Step 3: Merge strings.xml
  config = withStringsXmlModifications(config);
  
  // Step 4: Merge styles.xml (Phase F3.5)
  config = withStylesXmlModifications(config);
  
  return config;
};

module.exports = withForegroundService;

