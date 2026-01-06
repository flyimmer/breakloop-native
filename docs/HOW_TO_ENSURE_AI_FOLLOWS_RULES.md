# How to Ensure AI Assistants Follow Native Module Rules

## The Problem

AI assistants (including me) can forget critical steps when adding native modules, leading to:
- Files created but not registered
- Validation scripts not updated
- Silent runtime failures
- Wasted debugging time

## The Solution: Multi-Layer Enforcement

We've implemented **5 layers of enforcement** to ensure rules are followed:

### Layer 1: 📄 Cursor Rules (Highest Priority)

**File:** `.cursor/rules/native-modules.mdc`

**How it works:**
- Cursor automatically shows these rules to AI assistants
- Appears in the context for every conversation
- Highest priority - always visible

**What it contains:**
- Critical steps checklist
- Common mistakes to avoid
- Quick verification commands

**Why it works:**
- Always present in AI context
- Short and focused
- Impossible to miss

### Layer 2: 📚 Comprehensive Documentation

**File:** `docs/AI_ASSISTANT_RULES.md`

**How it works:**
- Detailed guide with examples
- Complete checklist with explanations
- Referenced from multiple places

**What it contains:**
- Step-by-step instructions
- Complete example (LocationModule)
- Common mistakes and how to avoid them
- Self-check questions for AI
- Verification procedures

**Why it works:**
- Provides context and reasoning
- Shows concrete examples
- Answers "why" not just "what"

### Layer 3: ✅ Quick Reference Checklist

**File:** `NATIVE_MODULE_CHECKLIST.md` (root directory)

**How it works:**
- Visible in root directory
- Quick reference without details
- Easy to scan

**What it contains:**
- Checkbox list of required steps
- Quick commands
- Minimal example

**Why it works:**
- Fast to check
- Root location = high visibility
- No excuses for "didn't see it"

### Layer 4: 🔧 Automated Validation

**File:** `scripts/validate-native-modules.js`

**How it works:**
- Runs automatically before every build
- Fails loudly if modules not registered
- Integrated into `npm run android`

**What it checks:**
- `MainApplication.kt` exists
- All required packages registered
- Exact registration strings present

**Why it works:**
- Can't skip it (runs automatically)
- Fails fast (before build)
- Clear error messages

### Layer 5: 📖 CLAUDE.md Integration

**File:** `CLAUDE.md` (updated)

**How it works:**
- First file AI assistants read
- Links to all other documentation
- Prominent warning at top

**What it contains:**
- Critical warning about native modules
- Links to detailed docs
- Key rule summary

**Why it works:**
- Entry point for AI context
- Establishes importance early
- Directs to detailed resources

## How These Layers Work Together

### Scenario: AI Asked to Add Native Module

**Step 1: AI Reads Context**
- Sees `.cursor/rules/native-modules.mdc` (always present)
- Sees `CLAUDE.md` warning (if reading project docs)
- Knows this is a critical operation

**Step 2: AI Plans Work**
- Checks `NATIVE_MODULE_CHECKLIST.md` for steps
- Reads `docs/AI_ASSISTANT_RULES.md` for details
- Understands WHY each step matters

**Step 3: AI Executes**
- Creates files in `plugins/src/`
- Updates plugin
- Updates validation script
- Runs validation commands

**Step 4: Validation Catches Mistakes**
- `npm run validate:native` runs automatically
- Fails if any step was missed
- AI sees failure and fixes it

**Step 5: Verification**
- AI checks `MainApplication.kt` manually
- Confirms registration is present
- Shows validation output to user

## For Users: How to Ensure Compliance

### When Asking AI to Add Native Module

**Good Request:**
```
Add a LocationModule for GPS tracking. 
Make sure to follow the native module checklist.
```

**Even Better:**
```
Add a LocationModule for GPS tracking.
Follow docs/AI_ASSISTANT_RULES.md and run validation.
```

### Red Flags to Watch For

If AI says:
- ❌ "I've created the Kotlin files" (without mentioning plugin)
- ❌ "The module is ready" (without showing validation)
- ❌ "You can test it now" (without running `npm run validate:native`)

**Ask:**
> "Did you update the plugin, validation script, and run npm run validate:native?"

### Verification Questions

Ask AI to show:
1. Plugin update diff
2. Validation script update diff
3. Output of `npm run validate:native`
4. Grep result for registration in `MainApplication.kt`

If AI can't show all 4, the work is incomplete.

## For AI Assistants: Self-Check Protocol

Before marking native module work complete, answer these:

1. **Did I edit files in `plugins/src/` (not `android/app/`)?**
   - If no → FAIL

2. **Did I update `plugins/withForegroundService.js`?**
   - Added paths?
   - Added copy logic?
   - Added registration function?
   - If any no → FAIL

3. **Did I update `scripts/validate-native-modules.js`?**
   - Added to `requiredPackages` array?
   - If no → FAIL

4. **Did I run `npm run validate:native`?**
   - Did it pass?
   - If no or didn't run → FAIL

5. **Did I verify registration in `MainApplication.kt`?**
   - Can I show the grep output?
   - If no → FAIL

**If ANY answer is FAIL, the task is NOT complete.**

## Maintenance

### Keeping Rules Up to Date

When native module process changes:

1. Update `.cursor/rules/native-modules.mdc` (most important)
2. Update `docs/AI_ASSISTANT_RULES.md`
3. Update `NATIVE_MODULE_CHECKLIST.md`
4. Update `CLAUDE.md` if needed
5. Update validation script if needed

### Testing the System

Periodically test that rules are enforced:

1. Ask AI to add a dummy module
2. Verify it follows all steps
3. Check validation runs and passes
4. Verify registration in code

## Success Metrics

The system is working if:

✅ AI always mentions the checklist when asked about native modules  
✅ AI always updates plugin AND validation script  
✅ AI always runs `npm run validate:native`  
✅ AI shows validation output without being asked  
✅ Validation catches mistakes before build  

## Troubleshooting

### "AI didn't follow the rules"

**Check:**
1. Is `.cursor/rules/native-modules.mdc` present?
2. Did you mention native modules in your request?
3. Did AI read the project context?

**Fix:**
- Explicitly reference the checklist in your request
- Ask AI to read `docs/AI_ASSISTANT_RULES.md`
- Show AI the validation failure

### "Validation script doesn't catch issue"

**Check:**
1. Is the package in `requiredPackages` array?
2. Is the registration string exactly correct?
3. Did you run `npm run validate:native`?

**Fix:**
- Update validation script
- Add more checks if needed
- Improve error messages

### "AI skipped validation"

**Check:**
1. Did you ask for validation output?
2. Did build fail?

**Fix:**
- Always ask: "Show me the validation output"
- Don't accept "it should work" without proof

## Summary

**Problem:** AI can forget critical steps  
**Solution:** 5 layers of enforcement

| Layer | File | Purpose |
|-------|------|---------|
| 1 | `.cursor/rules/native-modules.mdc` | Always visible to AI |
| 2 | `docs/AI_ASSISTANT_RULES.md` | Detailed guide |
| 3 | `NATIVE_MODULE_CHECKLIST.md` | Quick reference |
| 4 | `scripts/validate-native-modules.js` | Automated checking |
| 5 | `CLAUDE.md` | Entry point |

**Key Principle:** Make it **impossible to forget** and **impossible to skip**.

**Validation is the safety net** - even if AI forgets, validation catches it.

---

**Last Updated:** January 2026  
**Status:** Active enforcement system
