## current implementation plan
Roadmap v2 (Native-first → Native-only)
Principle: Track A is only “contract-completion shims” that unblock runtime correctness + migration.
Anything that is “nice” or “stability polish” is deferred.

Roadmap Rewrite — 
# Track A Minimal (because you’ll migrate anyway)
A0 — Freeze boundary (do not add more hybrid logic)
Goal: no more “JS decides runtime”.
    • JS is UI + button events only.
    • Native owns:
        ○ decision outcome (QT vs Intervention vs NoAction)
        ○ quota changes
        ○ suppression/cooldown
        ○ when/what overlay to show
A1 — Implement Post-QT Decision as a native feature (this is what’s missing)
Deliverable: Post-QT becomes deterministic and contract-complete.
    1. Post-QT completion handler (native)
    • onPostQuickTaskChoiceCompleted(app, sid, choice)
    • Always clears POST_CHOICE lock + cleans timers/state.
    • QUIT:
        ○ set quitSuppressedUntilMsByApp[app] = now + 2000
        ○ set postChoiceCooldownAtMsByApp[app] = now + 2000 (or just a single “blocked until”)
        ○ launch home
    • CONTINUE:
        ○ no cooldown
        ○ schedule handleMonitoredAppEntry(app, source="POST_CONTINUE") after ~100ms
        ○ DecisionGate decides:
            § qtRemaining > 0 → StartQuickTask (new session)
            § qtRemaining == 0 → StartIntervention
    2. Quota correctness
    • Ensure quota decrement is visible immediately in-memory at QT start (confirm/start), then persist async.
        ○ This prevents “immediate re-offer because qt still logs 100”.
    3. Emit-time guardrails
    • Defensive foreground validation (don’t block on null).
    • Launcher/SystemUI never triggers offers.
    • Quit suppression blocks offers for that app.
Why this phase matters: it replaces weeks of whack-a-mole with one contract-complete transition.
A2 — Minimal “storm hardening” only (no migration work yet)
Only the stuff that prevents event storms from creating fake sessions:
    • per-app debounce (you already have)
    • quit suppression window (per app)
    • post-choice cooldown window (per app, QUIT only)
    • no more ad-hoc JS workarounds
A3 — Keep remaining migration work explicitly OUT of Track A
These are real migrations, but not needed to stabilize QT correctness:
    • Compose overlay UI migration
    • SessionManager v1+ snapshot semantics
    • Native Settings UI
    • Stats pipeline
Track A stops once Quick Task + Post-QT + Continue/Quit behavior is contract-correct and stable.

# Track B — Migration (the real work; avoids rework)
B1 — Native Flow Authority v0 (M6)
Move flow transitions out of JS.
    • Create native state machines:
        ○ QuickTaskFlowState (already partially native due to timer + locks; finish it)
        ○ InterventionFlowState (minimal v0)
    • Inputs: wakeReason, user actions, timers, app switches, close events
    • Outputs: “show screen X” + side effects (set intention, start timer, preserve snapshot, etc.)
    • JS becomes UI renderer only, not decision maker
Deliverable: Native can drive the flow end-to-end even if UI is still RN.
B2 — Native UI incrementally (M7)
Port screens one by one to Compose:
    1. QuickTaskDialog (optional early, because it’s small)
    2. Post-QT choice
    3. Breathing
    4. Root cause
    5. Alternatives
    6. Action
    7. Action timer
Deliverable: Overlay UX increasingly native; less RN involved.
B3 — Preserve/Resume parity (M8)
Move/implement OS contract semantics in native:
    • snapshot validity rules
    • resume timer correctness
    • app switch / quit / re-enter behavior
Deliverable: Your tricky contract rules are native & testable.
B4 — SessionManager v1 runtime authority (M9)
Unify:
    • session lifecycle
    • suppression windows
    • preserve/resume lifecycle
    • cancellation vs preserve vs resume rules
Deliverable: One authoritative runtime brain (native).
B5 — Remove RN runtime dependencies (Phase 4)
Only after B1–B4 are working:
    • delete JS reducers/effects for intervention & intention
    • remove runtime modules (src/systemBrain, src/os, runtime contexts)
    • RN becomes settings-only or removed entirely

What we explicitly defer (to avoid rework)
    • H1 “event noise hardening” (ignore lists, debounce) — only do if storms block B1
    • H2 “latency/performance tuning” — only do after native flow works
    • Native Settings UI (Compose) — do whenever convenient; not on critical path

Execution order (minimal + fastest to Native-only)
    1. A2 Post-QT completion shim (unblocks correctness)
    2. B1 Native Flow Authority v0 (biggest payoff; reduces bugs)
    3. B2 Native UI incremental
    4. B3 Preserve/Resume parity
    5. B4 SessionManager v1
    6. B5 Remove RN runtime


## Branch: fix/Native_Migration_1-BasicTimingLogic
finished Track A


