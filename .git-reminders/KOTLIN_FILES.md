# ⚠️ REMINDER: Kotlin Files Workflow

**READ THIS BEFORE creating/modifying Kotlin files!**

## ✅ Validation is AUTOMATIC!

Validation runs automatically when you:
- Run `npm run android` (before build) ← **USE THIS, NOT `npx expo run:android`**
- Run `npm run prebuild` (before prebuild)
- Run `git commit` (before commit)

**⚠️ IMPORTANT:** 
- ✅ Use `npm run android` (validation runs)
- ❌ Don't use `npx expo run:android` (bypasses validation!)

**You don't need to run it manually!** (unless troubleshooting)

## Quick Checklist

1. ✅ Edit file in `plugins/src/android/java/...` (NOT in `android/app/`)
2. ✅ If NEW file → Update `plugins/withForegroundService.js`
3. ✅ Run `npm run android` ← **Validation runs automatically!**
4. ✅ If validation fails → Fix plugin, then rebuild

## Manual Validation (Optional)

Only run manually if:
- Troubleshooting plugin issues
- Verifying plugin changes
- Git hook is disabled

```bash
npm run validate:kotlin
```

## Full Documentation

- `docs/KOTLIN_FILE_WORKFLOW.md` - Complete workflow guide
- `docs/KOTLIN_VALIDATION_AUTOMATION.md` - Automation details

