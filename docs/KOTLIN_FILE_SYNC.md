# Kotlin File Sync System

## Problem

Expo config plugins only run during `expo prebuild`, not during regular `npm run android` builds. This means:
- Changes to Kotlin files in `plugins/src/` don't automatically copy to `android/app/src/main/`
- Developers must manually copy files or run `expo prebuild` (which is slow)
- Easy to forget, leading to "why isn't my code change working?" confusion

## Solution

We've implemented an automatic sync system that runs before every Android build.

### How It Works

1. **Sync Script** (`scripts/sync-kotlin-files.js`):
   - Compares files in `plugins/src/` with `android/app/src/main/`
   - Only copies files that have changed (fast!)
   - Shows clear status for each file (synced/skipped/error)

2. **Automatic Execution**:
   - `npm run android` → automatically runs `sync:kotlin` first
   - No manual intervention needed

3. **Files Synced**:
   - `ForegroundDetectionService.kt`
   - `InterventionActivity.kt`
   - `AppMonitorModule.kt`
   - `AppMonitorPackage.kt`
   - `AppMonitorService.kt`

### Usage

**Normal Development (Automatic):**
```bash
npm run android
# Automatically syncs Kotlin files before building
```

**Manual Sync (if needed):**
```bash
npm run sync:kotlin
# Syncs files without building
```

**Validation (check plugin config):**
```bash
npm run validate:kotlin
# Verifies all Kotlin files are registered in plugin
```

### Output Example

```
🔄 Syncing Kotlin plugin files...

✅ AppMonitorModule.kt - Synced
✓  InterventionActivity.kt - Already up to date
✓  AppMonitorPackage.kt - Already up to date

📊 Summary: 1 synced, 2 skipped, 0 errors

✨ Kotlin files synced successfully!
```

### Benefits

✅ **No manual copying** - Files sync automatically before every build  
✅ **Fast** - Only copies changed files  
✅ **Clear feedback** - Shows exactly what was synced  
✅ **Prevents errors** - Can't forget to sync files  
✅ **Works with git** - Changes in `plugins/src/` are the source of truth  

### Workflow

1. **Edit Kotlin file** in `plugins/src/android/java/com/anonymous/breakloopnative/`
2. **Run build**: `npm run android`
3. **Sync happens automatically** before build starts
4. **Build uses updated code** ✨

### When to Use `expo prebuild`

You still need `expo prebuild` when:
- Adding/removing Kotlin files (not just editing)
- Changing AndroidManifest.xml structure
- Modifying plugin configuration
- Setting up project for the first time

For **editing existing Kotlin files**, just use `npm run android` - the sync system handles it!

### Troubleshooting

**"Android directory not found"**
- Run `npx expo prebuild` first to generate the android directory

**Files not syncing**
- Check that files exist in `plugins/src/android/java/com/anonymous/breakloopnative/`
- Verify file names match exactly (case-sensitive)
- Run `npm run validate:kotlin` to check plugin configuration

**Changes not appearing in build**
- Clean build: `cd android && ./gradlew clean && cd ..`
- Then: `npm run android`

