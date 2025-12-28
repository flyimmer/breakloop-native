const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withStringsXml, withDangerousMod } = require('@expo/config-plugins');

/**
 * Expo Config Plugin: withForegroundService
 * 
 * Automatically configures the ForegroundDetectionService (AccessibilityService)
 * for BreakLoop's Android foreground app detection.
 * 
 * What this plugin does:
 * 1. Copies ForegroundDetectionService.kt to the correct Android directory
 * 2. Adds BIND_ACCESSIBILITY_SERVICE permission to AndroidManifest.xml
 * 3. Registers the AccessibilityService in AndroidManifest.xml
 * 4. Copies accessibility_service.xml to res/xml/
 * 5. Adds accessibility_service_description string to res/values/strings.xml
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
  return {
    kotlin: path.join(projectRoot, 'plugins', 'src', 'android', 'java', 'com', 'anonymous', 'breakloopnative', 'ForegroundDetectionService.kt'),
    accessibilityXml: path.join(projectRoot, 'plugins', 'src', 'android', 'res', 'xml', 'accessibility_service.xml'),
    stringsXml: path.join(projectRoot, 'plugins', 'src', 'android', 'res', 'values', 'strings.xml'),
  };
}

/**
 * Get the destination file paths (in android/app/src/main/)
 */
function getDestinationPaths(projectRoot) {
  const androidMainPath = path.join(projectRoot, 'android', 'app', 'src', 'main');
  return {
    kotlin: path.join(androidMainPath, 'java', 'com', 'anonymous', 'breakloopnative', 'ForegroundDetectionService.kt'),
    accessibilityXml: path.join(androidMainPath, 'res', 'xml', 'accessibility_service.xml'),
  };
}

/**
 * Copy Kotlin service file to Android directory
 */
function copyKotlinFile(projectRoot) {
  const { kotlin: sourcePath } = getSourcePaths(projectRoot);
  const { kotlin: destPath } = getDestinationPaths(projectRoot);
  
  // Ensure destination directory exists
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Copy file
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`[${PLUGIN_NAME}] Copied ForegroundDetectionService.kt`);
  } else {
    throw new Error(`[${PLUGIN_NAME}] Source file not found: ${sourcePath}`);
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
 * Modify AndroidManifest.xml to add permission and service
 */
function withAndroidManifestModifications(config) {
  return withAndroidManifest(config, async (config) => {
    const { modResults } = config;
    const { manifest } = modResults;
    
    // Ensure manifest exists
    if (!manifest) {
      throw new Error('[withForegroundService] AndroidManifest.xml not found');
    }
    
    // Add BIND_ACCESSIBILITY_SERVICE permission if not present
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    
    const permissions = Array.isArray(manifest['uses-permission'])
      ? manifest['uses-permission']
      : [manifest['uses-permission']];
    
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
      manifest['uses-permission'] = permissions;
      console.log(`[${PLUGIN_NAME}] Added BIND_ACCESSIBILITY_SERVICE permission`);
    }
    
    // Add AccessibilityService to application
    if (!manifest.application) {
      throw new Error('[withForegroundService] <application> tag not found in AndroidManifest.xml');
    }
    
    const application = Array.isArray(manifest.application) ? manifest.application[0] : manifest.application;
    
    if (!application.service) {
      application.service = [];
    }
    
    const services = Array.isArray(application.service) ? application.service : [application.service];
    
    // Check if ForegroundDetectionService is already registered
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
      application.service = services;
      console.log(`[${PLUGIN_NAME}] Registered ForegroundDetectionService in AndroidManifest.xml`);
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
 * Main plugin function
 * Chains file copying with config modifications
 */
const withForegroundService = (config) => {
  // Step 1 & 2: Copy files using withDangerousMod (runs during prebuild)
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      
      // Copy files
      copyKotlinFile(projectRoot);
      copyAccessibilityXml(projectRoot);
      
      return config;
    },
  ]);
  
  // Step 3: Modify AndroidManifest.xml (permission + service)
  config = withAndroidManifestModifications(config);
  
  // Step 4: Merge strings.xml
  config = withStringsXmlModifications(config);
  
  return config;
};

module.exports = withForegroundService;

