# Kotlin Plugin Automation Guide

This guide covers two automated systems:
1. **Kotlin File Sync** - Automatically copies changed files before builds
2. **Kotlin Validation** - Verifies all Kotlin files are registered in plugin

## 🔄 Automatic File Sync

Before every build, Kotlin files are automatically synced from `plugins/src/` to `android/app/src/main/`.

**What it does:**
- Compares source files with destination files
- Only copies files that have changed (fast!)
- Shows clear status for each file

**When it runs:**
- Before every `npm run android` (automatic)
- When you run `npm run sync:kotlin` (manual)

**See:** [KOTLIN_FILE_SYNC.md](KOTLIN_FILE_SYNC.md) for detailed documentation.

## ✅ Automatic Validation

Validation runs automatically in these scenarios:

### 1. **Before Every Build** (Automatic)
When you run:
```bash
npm run android
# or
npx expo run:android
```

The `android` script in `package.json` now includes:
```json
"android": "npm run sync:kotlin && npm run validate:kotlin && expo run:android"
```

**Result:** 
1. Kotlin files sync automatically from `plugins/src/` to `android/`
2. Validation runs automatically
3. Build fails if validation fails

### 2. **Before Prebuild** (Automatic)
When you run:
```bash
npm run prebuild
# or
npx expo prebuild
```

The `prebuild` script includes:
```json
"prebuild": "npm run validate:kotlin && expo prebuild"
```

**Result:** Validation runs automatically before prebuild.

### 3. **Before Every Commit** (Automatic - Git Hook)
When you run:
```bash
git commit
```

The `.git/hooks/pre-commit` hook automatically runs validation.

**Result:** Commit is blocked if validation fails (unless you use `--no-verify`).

## 🔧 Manual Validation

### When to Run Manually

Run `npm run validate:kotlin` manually when:

1. **After editing plugin files directly**
   - You modified `plugins/withForegroundService.js`
   - You want to verify your changes are correct

2. **After creating new Kotlin files**
   - You added a new `.kt` file to `plugins/src/`
   - You want to check if it's in the plugin before building

3. **Before committing (if hook is disabled)**
   - Git hooks might be disabled in your environment
   - You want to double-check before pushing

4. **During troubleshooting**
   - Build is failing and you suspect plugin issue
   - You want to verify plugin configuration

### How to Run Manually

```bash
npm run validate:kotlin
```

## 🚫 Skipping Validation (Not Recommended)

### Skip for Build

If you **absolutely must** build without validation (emergency only):
```bash
# Use the direct script (bypasses validation)
npm run android:direct
# or
npx expo run:android
```

**⚠️ Warning:** 
- Only use this if you're 100% sure the plugin is correct
- You risk losing changes if files aren't in plugin
- Always run validation manually first: `npm run validate:kotlin`

### Skip for Commit

If you need to commit without validation (not recommended):
```bash
git commit --no-verify
```

**⚠️ Warning:** Only skip validation if you're absolutely sure the plugin is correct!

## 📊 Summary Table

| Action | Sync Runs? | Validation Runs? | How |
|--------|------------|------------------|-----|
| `npm run android` | ✅ **Yes** | ✅ **Yes** | Automatic (npm script) - **RECOMMENDED** |
| `npm run android:direct` | ❌ No | ❌ No | Bypasses both (emergency only) |
| `npx expo run:android` | ❌ No | ❌ No | Bypasses both (not recommended) |
| `npm run prebuild` | ❌ No | ✅ **Yes** | Automatic (npm script) |
| `npx expo prebuild` | ❌ No | ❌ No | Bypasses npm script |
| `git commit` | ❌ No | ✅ **Yes** | Automatic (git hook) |
| `git commit --no-verify` | ❌ No | ❌ No | Skips hook |
| `npm run sync:kotlin` | ✅ Yes | ❌ No | Manual sync only |
| `npm run validate:kotlin` | ❌ No | ✅ Yes | Manual validation only |

## 💡 Best Practices

1. **ALWAYS use `npm run android`** (never `npx expo run:android`)
   - ✅ Automatically syncs Kotlin files
   - ✅ Ensures validation runs automatically
   - ✅ Catches mistakes early
   - ✅ Prevents lost changes
   - ❌ `npx expo run:android` bypasses both sync and validation (risky!)

2. **Edit Kotlin files in `plugins/src/` (source of truth)**
   - ✅ Changes automatically sync to `android/` before builds
   - ✅ Changes are tracked in git
   - ❌ Never edit files directly in `android/app/src/main/` (will be overwritten!)

3. **Don't skip sync or validation** unless absolutely necessary
   - Both are fast (< 1 second each)
   - Prevents lost changes and build failures

4. **Fix validation errors immediately**
   - Don't commit with `--no-verify` to bypass
   - Fix the plugin configuration properly

5. **Run manual commands when in doubt**
   - `npm run sync:kotlin` - After editing Kotlin files
   - `npm run validate:kotlin` - After making plugin changes
   - Both run automatically with `npm run android`

## 🔍 Troubleshooting

### Validation fails but plugin looks correct

1. Check if file exists in `plugins/src/`
2. Verify filename matches exactly (case-sensitive)
3. Check plugin file syntax (JavaScript errors)
4. Run `npm run validate:kotlin` to see detailed error

### Git hook not running

1. Check if `.git/hooks/pre-commit` exists
2. Verify it's executable (Unix/Mac): `chmod +x .git/hooks/pre-commit`
3. Check git config: `git config core.hooksPath` (should be empty or `.git/hooks`)

### Want to disable hook temporarily

```bash
# Rename hook (disables it)
mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled

# Restore hook (enables it)
mv .git/hooks/pre-commit.disabled .git/hooks/pre-commit
```

