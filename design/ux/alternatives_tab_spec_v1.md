# BreakLoop — Alternatives Tab Spec (v1)

**Document:** `alternatives_tab_spec_v1.md`  
**Scope:** Main-app “Alternatives” tab UX + data model + navigation (independent of Intervention flow).  
**Primary job:** Give users a fast, low-friction place to pick a better action instead of scrolling — even when they don’t know their trigger.  
**Secondary job:** Keep emotional awareness (the 6 triggers + Other) first-class, without forcing it in the default intervention path.

---

## 0) UX principles

1. **Fast retrieval > reflection** in the Alternatives tab (reflection is optional).
2. **User-owned library:** users can add/edit/delete and favorite activities easily.
3. **Triggers stay first-class:** Boredom / Stress(Anxiety) / Lonely / Fatigue / Self-doubt / No clear goal + **Other**.
4. **Multiple ways to browse:** Triggers is one grouping; users can also browse by **Context** or **Type** (more “action-first”).
5. **Low typing burden:** creating an activity should require only **Title + Trigger(s)**.

---

## 1) Information architecture

### 1.1 Entry points
- Main app navigation: Bottom tab **Alternatives**
- From Intervention: “Support me, show me alternative activities” deep-links here filtered to a trigger (see §6)

### 1.2 Sub-tabs inside Alternatives
- **My List** (default landing): the user’s saved + created activities
- **Discover**: curated starter pack and local recommendations (no backend in v1)
- *(Optional/hidden in v1)* **AI For You**: can be stubbed or feature-flagged

---

## 2) Triggers (core taxonomy)

### 2.1 Trigger enum
- `BOREDOM`
- `STRESS_ANXIETY`
- `LONELINESS`
- `FATIGUE`
- `SELF_DOUBT`
- `NO_CLEAR_GOAL`
- `OTHER` (requires `otherLabel`)

### 2.2 Trigger rules
- Every activity must have **≥ 1 trigger**.
- Secondary triggers are allowed but optional in v1.

---

## 3) Activity data model (keep simple)

### 3.1 Required fields (v1)
- `id` (uuid)
- `title` (string; short, action-oriented)
- `triggers` (array<Trigger>; min 1)
- `instructions` (string; optional but recommended; 1–3 lines)
- `isFavorite` (bool)
- `source` (enum): `STARTER_PACK | USER_CREATED`
- `createdAt`, `updatedAt` (timestamps)

### 3.2 Optional lightweight fields (v1)
Only store if the UI uses them; never require them for creation.
- `tags` (array<string>) — e.g., `no_phone`, `outside`, `movement`, `social`, `calm`,
  `planning`, `creative`, `at_home`, `no_feed`, `learning`, `practical`
- `phonePolicy` (enum): `NO_PHONE | INTENTIONAL_OK | EITHER` (default `EITHER`)
- `effort` (enum): `LOW | MEDIUM | HIGH`
- `otherLabel` (string) — only when triggers include `OTHER`
- `notes` (string) — optional extra hint
- `lastUsedAt` (timestamp) — for “Recent” sorting later (optional)

### 3.3 Minimal creation form (v1)
**Only require:**
1) Title  
2) Trigger (single-select by default; multi-select can be “Advanced” later)

Everything else optional.

---

## 4) Grouping & filtering (My List + Discover)

### 4.1 Group-by control
Single control at top of the list: **Group by:** `[Triggers ▾]`

**v1 group options (recommended):**
1. **Triggers** (default) — sections for the 6 triggers + Other
2. **Context** — where/with whom/how (derived from tags)
3. **Type** — the activity nature (derived from tags)

> Time is intentionally not a v1 grouping: you’re not storing duration, and users won’t reliably maintain it.

### 4.2 Context groups (derived)
Examples:
- No phone
- Outside
- At home
- Social / connection
- Movement
- Calm
- Planning
- Creative
- Learning
- Practical
- No feed

Rule: if multiple context tags exist, assign a **primary context** by a priority list
(e.g., `no_phone` > `outside` > `social` > `movement` > …), but still show tag chips.

### 4.3 Type groups (derived, simple)
Suggested types:
- Breathe / Calm
- Move
- Connect
- Plan
- Create
- Learn
- Rest / Recover
- Tidy / Practical

Rule: map from tags to **one primary type** via priority list.

### 4.4 Filters (quick chips)
Optional filter chips below search (multi-select), showing only 6–8 most useful ones:
- No phone, Outside, Social, Movement, Low effort, Calm, Planning, Creative, No feed

### 4.5 Search
Search over `title`, `instructions`, `otherLabel`, `notes`, and `tags`.

---

## 5) Screen specs

## 5.1 Alternatives → My List (default)
Primary use case: “I want to quickly find something from my own list.”

Layout:
1) Header: “Alternatives”
2) Search: “Search activities…”
3) Group-by control (default: Triggers)
4) Optional “Favorites” row (up to 6)
5) Grouped sections + cards

Card content (compact):
- Title
- 1-line instruction preview (if present)
- Up to 3 tag chips
- Actions: ⭐ Favorite, ✎ Edit, 🗑 Delete (confirm)

Tap card → Activity Detail sheet.

### 5.2 Activity Detail (bottom sheet)
Shows:
- Title
- Triggers (chips)
- Instructions (full)
- Tags (chips)
- Buttons:
  - **Do this now**
  - **Saved / Save to My List** (depends on source tab)
  - Edit (if user-created) / Duplicate (optional)

**Do this now** (v1):
- set `lastUsedAt = now`
- show micro-confirmation: “Nice. Put the phone down and start.”
- button: Done

No timers in v1.

---

## 5.3 Alternatives → Discover
Purpose: curated ideas + starter pack.

Layout:
1) Header: “Discover”
2) Search
3) Group-by control
4) Grouped sections + cards

Discover card primary action: **Save to My List**

Starter pack:
- Import defaults from your existing starter pack content.
- Settings action: “Restore Starter Pack” (not on the main list screen).

---

## 5.4 Add / Edit activity (simple)
Add button: floating “+” in My List.

Add form (minimal):
- Title (required)
- Trigger(s) (required) — 6 triggers + Other
  - if Other selected: show “Label” field (required)
- Instructions (optional)
- Tags (optional quick chips)
- Save

Edit uses the same + Delete.

---

## 6) Deep link behavior from Intervention

Deep link intent:
`openAlternatives(trigger=<TRIGGER>, source=intervention, returnTo=<checkpointSurfaceId>)`

Behavior:
1) Open Alternatives → **My List**
2) Apply:
   - Group-by = Triggers
   - Auto-scroll to the trigger section
   - Highlight that section header briefly (1s)
3) Show a temporary top bar only for `source=intervention`:
   - Left: “← Back” (returns to checkpoint surface)
   - Title: “Alternatives for <Trigger>”
   - Right: X (same as back)

If user taps “Do this now”:
- stay in Alternatives after confirmation
- user can return via top bar Back

---

## 7) Where “Why” content lives (v1)

Not shown in checkpoints by default.

Recommended placements:Trigger header (when Group-by = Triggers): 
Goal: keep “Why” contextual and skimmable, not blocking.
 Show “why” as a collapsed blurb on each trigger section header when Group-by = Triggers.

Default collapsed: 1 line (e.g., “Boredom is a signal to explore — feeds numb it.”)
Tap to expand: shows the same 1 sentence + 2 bullets.
It should never block the list.
This serves the main-app use case: users sometimes open Alternatives without a trigger; when they do pick a trigger section, the why helps reinforce learning over time.

the why is defined in trigger_paragraphs_v3.md

---

## 8) Non-goals (v1)
- No community backend
- No social likes
- No duration estimates
- No required AI generation

---

## 9) Acceptance checklist (v1)
- User can add an activity with only Title + Trigger
- User can browse by Triggers / Context / Type
- Search works
- Deep link from Intervention opens the right trigger section + provides a clear return path
- “Why” is optional + collapsed by default