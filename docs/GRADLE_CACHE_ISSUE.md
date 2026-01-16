# Gradle Kotlin Compilation Cache Issue

## Problem

After modifying Kotlin files, rebuilds appear to succeed but the changes don't appear in the running app. Native logs don't show up, and the app behaves as if the old code is still running.

## Root Cause

`./gradlew clean` does **NOT** delete the `android/app/build/tmp/kotlin-classes/` directory, which contains the compiled Kotlin `.class` files. This causes Gradle's incremental build system to:

1. See that a compiled `.class` file exists
2. Check if the source `.kt` file is newer than the compiled `.class` file
3. If the `.class` file timestamp is newer or equal, skip recompilation
4. Reuse the old compiled code in the new APK

**Result:** The APK is rebuilt with a new timestamp, but contains old compiled code.

## Real-World Example

**What happened (January 13-14, 2026):**

- Source file modified: `13.01.2026 22:56:37`
- Compiled once: `13.01.2026 22:57:20`
- All subsequent builds (including `14.01.2026 13:19:49`) reused the `22:57:20` compiled class
- Source file timestamp (`22:56:37`) was older than compiled class (`22:57:20`), so Gradle skipped recompilation
- Result: 2 days of "clean builds" that didn't actually recompile the Kotlin code

## Solution

### Before Every Kotlin Build

**DO NOT use `./gradlew clean` alone!** You must delete the compiled Kotlin classes first:

```powershell
# Delete compiled Kotlin classes (gradle clean doesn't do this!)
Remove-Item -Recurse -Force android\app\build\tmp\kotlin-classes -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android\app\build\intermediates\classes -ErrorAction SilentlyContinue

# Then clean
cd android && ./gradlew clean && cd ..
```

### Using npm Script

We've added a `clean:native` script to `package.json`:

```bash
npm run clean:native
```

This automatically deletes the Kotlin compiled classes and runs `./gradlew clean`.

### Verification After Build

After building, verify the compiled class was actually recompiled:

```powershell
# Check compiled class timestamp is NEWER than source
$source = (Get-Item "plugins\src\android\java\com\anonymous\breakloopnative\AppMonitorModule.kt").LastWriteTime
$compiled = (Get-Item "android\app\build\tmp\kotlin-classes\debug\com\anonymous\breakloopnative\AppMonitorModule.class").LastWriteTime

if ($compiled -gt $source) {
    Write-Host "✅ Kotlin code was recompiled"
} else {
    Write-Host "❌ WARNING: Using stale compiled code! Delete kotlin-classes and rebuild."
}
```

## Why This Happens

Gradle's incremental build system is designed to speed up builds by reusing compiled code when possible. The `./gradlew clean` task is designed to clean "build outputs" (APKs, intermediate files), but not "compiled source code" (`.class` files in `tmp/kotlin-classes/`).

This is intentional behavior for normal development workflows where you want fast incremental builds. However, when you need to force a complete recompilation (e.g., after making significant changes or debugging compilation issues), you must manually delete the compiled classes.

## Prevention

1. **Always use `npm run clean:native`** (not `./gradlew clean`) before building after Kotlin changes
2. **Verify compiled class timestamps** after build to ensure recompilation occurred
3. **If logs don't appear**, check compiled class timestamp first before assuming other issues

## Related Documentation

- See `spec/development_workflow_guide_c213276d.plan.md` for complete verification protocol
- See `CLAUDE.md` for Native Code Verification Protocol
