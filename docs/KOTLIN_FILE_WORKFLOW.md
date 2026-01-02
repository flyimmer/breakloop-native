# Kotlin File Workflow Guide

## 🚨 CRITICAL WARNING FOR AI ASSISTANTS 🚨

**BEFORE EDITING ANY `.kt` FILE:**
1. ❌ **STOP if path contains `android/app/src/main/`** - This is WRONG!
2. ✅ **ONLY edit files in `plugins/src/android/`** - This is CORRECT!
3. ⚠️ Files in `android/app/` are AUTO-GENERATED and will be OVERWRITTEN!

**Rule: If you're about to edit a `.kt` file, check the path FIRST!**

---

## Directory Structure

```
plugins/src/android/java/com/anonymous/breakloopnative/  ← SOURCE OF TRUTH
  ├── AppMonitorModule.kt          ✅ Copied by plugin
  ├── ForegroundDetectionService.kt ✅ Copied by plugin
  ├── InterventionActivity.kt       ✅ Copied by plugin
  ├── AppMonitorPackage.kt          ❌ NOT copied (needs plugin update)
  └── AppMonitorService.kt          ❌ NOT copied (needs plugin update)

android/app/src/main/java/com/anonymous/breakloopnative/  ← GENERATED (can be overwritten)
  ├── AppMonitorModule.kt          ← Copied from plugin
  ├── ForegroundDetectionService.kt ← Copied from plugin
  ├── InterventionActivity.kt       ← Copied from plugin
  ├── AppMonitorPackage.kt          ← Manual copy needed
  ├── AppMonitorService.kt          ← Manual copy needed
  ├── MainApplication.kt            ← Native only (not in plugin)
  └── MainActivity.kt               ← Native only (not in plugin)
```

## ⚠️ CRITICAL RULES

### 1. **ALWAYS Edit Plugin Files First**
   - ✅ Edit files in `plugins/src/android/java/...`
   - ❌ **NEVER** edit files in `android/app/src/main/java/...` directly
   - Files in `android/app/` are **GENERATED** and can be overwritten during rebuild

### 2. **Plugin Copy Process**
   - When you run `npx expo prebuild` or `npx expo run:android`, the plugin automatically copies:
     - `ForegroundDetectionService.kt`
     - `InterventionActivity.kt`
     - `AppMonitorModule.kt`
   - **These files are overwritten during every build!**

### 3. **Files NOT in Plugin**
   - `AppMonitorPackage.kt` - Currently NOT copied by plugin
   - `AppMonitorService.kt` - Currently NOT copied by plugin
   - **Solution**: Manually keep both locations in sync, OR update plugin to include them

### 4. **Native-Only Files**
   - `MainApplication.kt` - Only exists in `android/app/` (not in plugin)
   - `MainActivity.kt` - Only exists in `android/app/` (not in plugin)
   - **These are safe to edit directly** (not overwritten by plugin)

## 📋 Workflow Checklist

### When Adding/Modifying Kotlin Files:

1. **Edit plugin file first** (`plugins/src/...`)
   ```bash
   # Edit the source file
   code plugins/src/android/java/com/anonymous/breakloopnative/MyFile.kt
   ```

2. **If creating a NEW file, update the plugin** (`plugins/withForegroundService.js`)
   - Add to `getSourcePaths()`
   - Add to `getDestinationPaths()`
   - Add `copyFileSync()` call in `copyKotlinFiles()`
   - See "Fixing Missing Files in Plugin" section below

3. **Validate plugin configuration:**
   ```bash
   npm run validate:kotlin
   # This will catch any missing files BEFORE build
   ```

4. **Rebuild to verify:**
   ```bash
   npx expo run:android
   # Plugin will automatically copy files
   ```

5. **Check git status:**
   ```bash
   git status
   # Should show changes in BOTH locations (plugin + app)
   ```

6. **Commit both locations:**
   ```bash
   git add plugins/src/android/java/.../MyFile.kt
   git add android/app/src/main/java/.../MyFile.kt  # Auto-copied by plugin
   git add plugins/withForegroundService.js  # If plugin was updated
   git commit -m "Add/update MyFile.kt"
   ```

## ✅ MANDATORY: Run Validation Before Build

**ALWAYS run validation before building:**
```bash
npm run validate:kotlin
```

This script checks if all Kotlin files in `plugins/src/` are included in the plugin configuration. If a file is missing, it will:
- ❌ Fail with clear error message
- 📝 Show which files are missing
- 💡 Provide instructions to fix

**Why this matters:**
- Prevents lost changes (files not copied during build)
- Catches mistakes early (before commit)
- Works across different chat sessions (script remembers, I might not)

## 🔧 Fixing Missing Files in Plugin

If a file should be copied by plugin but isn't:

1. **Update `plugins/withForegroundService.js`:**
   ```javascript
   // Add to getSourcePaths()
   myNewFile: path.join(javaPath, 'MyNewFile.kt'),
   
   // Add to getDestinationPaths()
   myNewFile: path.join(javaPath, 'MyNewFile.kt'),
   
   // Add to copyKotlinFiles()
   if (fs.existsSync(sourcePaths.myNewFile)) {
     fs.copyFileSync(sourcePaths.myNewFile, destPaths.myNewFile);
     console.log(`[${PLUGIN_NAME}] Copied MyNewFile.kt`);
   }
   ```

2. **Test the plugin:**
   ```bash
   npx expo prebuild --clean
   # Verify file is copied to android/app/
   ```

## 🚨 Common Mistakes

### ❌ DON'T:
- Edit files in `android/app/` directly (they get overwritten)
- Forget to update plugin when adding new files
- Only commit one location (plugin OR app, not both)
- **Skip validation** (`npm run validate:kotlin`)

### ✅ DO:
- Always edit plugin files first
- **Run `npm run validate:kotlin` before every build**
- Update plugin when adding new files
- Check git status before committing
- Test rebuild after changes

## 🤖 For AI Assistants (Claude, ChatGPT, etc.)

**MANDATORY CHECKLIST when creating/modifying Kotlin files:**

1. ✅ Edit file in `plugins/src/android/java/...`
2. ✅ If NEW file → Update `plugins/withForegroundService.js`:
   - Add to `getSourcePaths()`
   - Add to `getDestinationPaths()`
   - Add `copyFileSync()` in `copyKotlinFiles()`
3. ✅ **Run `npm run validate:kotlin`** ← **DO NOT SKIP THIS**
4. ✅ If validation fails → Fix plugin, then re-run validation
5. ✅ Only then run `npx expo run:android`
6. ✅ Check `git status` to verify all files are tracked
7. ✅ Commit both plugin file AND plugin config changes

**The validation script is your safety net - it will catch mistakes even if I forget!**

## 📝 Current Status

**Files in Plugin (auto-copied):**
- ✅ `ForegroundDetectionService.kt`
- ✅ `InterventionActivity.kt`
- ✅ `AppMonitorModule.kt`

**Files NOT in Plugin (manual sync needed):**
- ⚠️ `AppMonitorPackage.kt` - **TODO: Add to plugin**
- ⚠️ `AppMonitorService.kt` - **TODO: Add to plugin**

**Native-Only Files (safe to edit):**
- ✅ `MainApplication.kt`
- ✅ `MainActivity.kt`

## 🔄 Recommended Next Steps

1. **Update plugin** to include `AppMonitorPackage.kt` and `AppMonitorService.kt`
2. **Remove manual copies** from `android/app/` (let plugin handle it)
3. **Test rebuild** to verify plugin works correctly
4. **Document** any new files added to plugin

