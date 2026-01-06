# Native Module Checklist

> Quick reference for adding/modifying native modules. See `docs/AI_ASSISTANT_RULES.md` for full details.

## ✅ Mandatory Steps

### Step 1: Create Files
- [ ] `plugins/src/android/java/com/anonymous/breakloopnative/YourModule.kt`
- [ ] `plugins/src/android/java/com/anonymous/breakloopnative/YourPackage.kt`
- [ ] `src/native-modules/YourModule.ts`

### Step 2: Update Plugin
- [ ] Add to `getSourcePaths()` in `plugins/withForegroundService.js`
- [ ] Add to `getDestinationPaths()` in `plugins/withForegroundService.js`
- [ ] Add copy logic in `copyKotlinFiles()`
- [ ] Create/update registration function (e.g., `registerYourPackage()`)
- [ ] Call registration in main plugin function

### Step 3: Update Validation
- [ ] Add to `requiredPackages` in `scripts/validate-native-modules.js`

### Step 4: Test
```bash
npx expo prebuild --clean
npm run validate:native  # MUST PASS ✅
npm run android
```

### Step 5: Verify
```bash
grep "add(YourPackage())" android/app/src/main/java/com/anonymous/breakloopnative/MainApplication.kt
```

## 🚨 Critical Rules

1. **NEVER** edit files in `android/app/` - always edit in `plugins/src/`
2. **ALWAYS** run `npm run validate:native` before building
3. **ALWAYS** use `npx expo prebuild --clean` after plugin changes
4. **VERIFY** registration in `MainApplication.kt` manually

## ⚡ Quick Commands

| Command | Purpose |
|---------|---------|
| `npx expo prebuild --clean` | Regenerate android folder |
| `npm run validate:native` | Check module registration |
| `npm run sync:kotlin` | Sync Kotlin files |
| `npm run android` | Build (includes validation) |

## 📋 Example

Adding `LocationModule`:

1. Create `plugins/src/android/java/.../LocationModule.kt`
2. Create `plugins/src/android/java/.../LocationPackage.kt`
3. Update `plugins/withForegroundService.js`:
   - Add paths
   - Add copy logic
   - Add `registerLocationPackage()`
4. Update `scripts/validate-native-modules.js`:
   - Add `LocationPackage` to `requiredPackages`
5. Test:
   ```bash
   npx expo prebuild --clean
   npm run validate:native  # ✅
   npm run android
   ```

## 🔍 Verification

After `expo prebuild`, look for:
```
[withForegroundService] Copied YourModule.kt
[withForegroundService] Copied YourPackage.kt
[withForegroundService] ✅ Registered YourPackage in MainApplication.kt
```

After `npm run validate:native`, look for:
```
✅ YourPackage
   Your module description

✅ All native modules are properly registered!
```

## 📚 Full Documentation

- `docs/AI_ASSISTANT_RULES.md` - Complete guide with examples
- `docs/NATIVE_MODULE_REGISTRATION_FIX.md` - Why this matters
- `docs/PREVENTION_CHECKLIST.md` - Prevention strategies
- `.cursor/rules/native-modules.mdc` - Cursor AI rules
