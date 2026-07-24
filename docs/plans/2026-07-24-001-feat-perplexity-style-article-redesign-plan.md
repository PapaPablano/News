---
title: Perplexity-Style Article Redesign
type: feat
status: completed
date: 2026-07-24
origin: docs/brainstorms/2026-07-24-perplexity-style-article-redesign-requirements.md
---

# Perplexity-Style Article Redesign

## Overview

Replace the flat `narrative[]` sentence array in the synthesis JSON contract with a `headline` field and a `sections[]` structure (subheadings + flowing prose), add a schema version field to make the shared-contract deploy risk mechanically detectable, add a consistent disagreement-signal visual language (sentence-level, section-level, and a shared front-page/article-page badge), soften the no-disagreement wording so it never overclaims certainty, and add a small related-beats navigation strip. This is a from-scratch redesign of the article reading experience, not an incremental tweak — it touches the shared synthesis contract consumed by both producers (the scheduled GitHub Actions job and the Cloudflare Worker) and all three front-end pages.

**Execution sequencing (critical):** Units 1 and 3 must land in the same deploy — do not merge/deploy Unit 1 (the new validator and prompt, which both producers pick up immediately since they import the same shared files) without Unit 3 (the renderer that knows how to read the new shape) already in place. Landing Unit 1 alone would mean the very next scheduled GitHub Actions run, or the next live search, writes/returns `headline`+`sections[]` data with no `narrative[]` field, while the still-deployed old `render-article.js` does `data.narrative.map(...)` unconditionally and throws — breaking the live article view for every entry produced during the gap. Work through Units 1-6 on a branch and ship them together; do not let the scheduled job run against a partially-updated `main`.

## Problem Frame

(see origin: docs/brainstorms/2026-07-24-perplexity-style-article-redesign-requirements.md)

The current article view reads like a structured data dump — a flat list of sentences each tagged with a colored source chip — rather than a piece of journalism. A side-by-side comparison against Perplexity's Discover page showed a materially more polished writing structure (headline, themed sections) and citation presentation. Two rounds of document review on the origin requirements surfaced and resolved a real risk in the naive version of this redesign: polished prose plus a bottom-only disagreement panel could let a skimming reader miss disagreement entirely, or let missed detection look identical to true consensus. This plan implements the fully-resolved requirements, including the mitigations the origin document settled on (a shared skimming-safety-net indicator, scoped rather than affirmative "no disagreement" copy, and an atomic-deploy decision that this plan gives a concrete enforcement mechanism to).

## Requirements Trace

- R1. Synthesis output includes a generated `headline`.
- R2. Body content organized into 2-4 themed sections (floor of 1 for thin stories), each with a subheading and short flowing prose.
- R3. Each section shows its contributing sources once, as a quiet non-color-coded list.
- R4. Disputed sentences get a color + non-color visual cue; cross-section disagreement gets symmetric, paired framing labels; the two signal types compose independently.
- R5. The Snapshot panel stays first-class and prominent; its no-disagreement state uses scoped, non-affirmative copy.
- R6. Front-page beat cards show the headline (falling back to `consensus` for pre-redesign entries) plus the shared R8 indicator.
- R7. A "More from your beats" strip (up to 3 other beats, omitted if none available, per-beat failures skipped, headline-fallback for pre-redesign candidates) appears on the beat page and search page.
- R8. A shared disagreement indicator appears on both the front page and the article page, sharing R4's visual language, clickable to the Snapshot panel on the article page.

## Scope Boundaries

- Not addressing factual/numeric accuracy of synthesized content (separate, already-identified problem).
- No migration of existing archived JSON entries to the new schema — old entries render via explicit fallback paths only where the origin document calls for one (front-page card, related-strip), not in the full article view. The full article view's `schemaVersion`-mismatch fallback is a distinct, permanent "this is an older article format" message for these entries, not an error state (see Unit 3).
- No political-leaning/bias labeling (unchanged, out of scope for the app generally).
- The related-beats strip is not a topic-similarity recommender — simple "other tracked beats" navigation only.
- Not attempting to improve Claude's underlying disagreement-detection reliability — accepted as an out-of-scope model-reliability risk (see origin doc).
- No new CSS breakpoint system — the app has none today; new components are manually checked at narrow viewports rather than gaining a new responsive framework.

### Deferred to Separate Tasks

- Documenting the schema-versioning pattern used here in `docs/solutions/` (the directory doesn't exist yet) — worth doing after this ships via `ce:compound`, not part of this implementation.

## Context & Research

External research was not used for this plan: the codebase already has strong, consistent local patterns for every layer this work touches (shared schema validation, prompt building, `node:test` with injected fakes, plain-JS front-end rendering, single-file CSS with reusable custom properties) and introduces no new framework, library, or technology layer.

### Relevant Code and Patterns

- **Shared contract via relative imports, not a package**: `worker/src/handler.js` and `scripts/lib/synthesize.js` both import `schema/build-prompt.js` and `schema/validate-synthesis.js` by relative path. A schema edit is a single change both producers pick up automatically and immediately — which is exactly why the Execution Sequencing note above matters: there is no way to update the schema for "just one producer" or stage the rollout gradually. This plan's `schemaVersion` field (see Key Technical Decisions) is designed for this existing architecture, but it detects a partial rollout after the fact — it does not prevent one, which is why the units must ship together.
- **`schema/validate-synthesis.js`** (current shape): top-level `generatedAt`, `query`, `consensus`, `sourceList`, `narrative[]` (`text`, `sources[]` cross-checked against `sourceList`, `stance` enum), `disagreementGroups[]`. Plain accumulator-style validator (`{valid, errors[]}`), no schema library.
- **`schema/build-prompt.js`**: `buildSynthesisPrompt({topic, articles})` branches on whether articles were pre-fetched (scheduled job) or not (Worker's live web-search path) but returns one prompt shape for both producers.
- **Front-end consumption today**: `js/render-article.js` reads `narrative`, `consensus`, `disagreementGroups` only via a direct, unguarded `data.narrative.map(...)` — never `headline`, `query`, `generatedAt`, or `sourceList`, and never checks whether `narrative` exists first. `js/beat-page.js` and `js/search-page.js` both call the shared `renderArticle()` synchronously and assign its return value directly to `.innerHTML`. `js/front-page.js` reads `latest.consensus`/`latest.generatedAt` directly and does **not** go through `renderArticle()` — it only imports `escapeHtml` from that module. This asymmetry is exactly why Unit 5 needs its own change, not a free ride from Unit 3.
- **Test convention**: `node:test` + `node:assert/strict`, colocated `*.test.js`, no real network — `fetchImpl`/fake-client injection is the established pattern (`scripts/lib/rss.js`'s `fetchFeed(url, fetchImpl)`, `scripts/refresh-beats.js`'s `collectArticles(beat, sources, fetchImpl)`, `worker/src/handler.test.js`'s `fakeClient`). `scripts/lib/synthesize.test.js` triggers its validation-failure test case via `{ ...validResult, narrative: [] }` — this literal will need to change to a `sections`-based violation once `narrative` no longer exists in the schema, or the test silently stops testing what it claims to (see Unit 1).
- **CSS conventions**: single flat `css/style.css`, no BEM/preprocessor, reusable custom properties (`--agree`, `--dissent`, `--border`) referenced by both component classes and semantic-state modifier classes (`.chip-agree`/`.chip-dissent`, `.history-item.active`). New disagreement-signal styling should reuse `--agree`/`--dissent` rather than introducing new color tokens, matching the origin document's "one consistent visual language" goal. No media queries exist anywhere in the file today. `js/front-page.js` has no dedicated test file today (confirmed) — its existing verification approach is manual browser checking, which Unit 5 continues rather than introducing new automated coverage for a file that has none.

### Institutional Learnings

None available — `docs/solutions/` does not exist in this repository yet.

### External References

None used (see rationale above).

## Key Technical Decisions

- **Add a `schemaVersion` field to the synthesis contract, checked on both ends**: turns an out-of-sync deploy into a clean, user-visible fallback instead of a broken page or a thrown error — but see Execution Sequencing above: this detects a partial rollout, it does not replace shipping Units 1 and 3 together.
- **`renderArticle()` distinguishes "missing `schemaVersion`" from "present but wrong `schemaVersion`"**: these are different situations needing different copy. A pre-redesign archive entry (reachable indefinitely via `beat-page.js`'s history strip, since no migration is planned) has no `schemaVersion` field at all — for this case, `renderArticle()` shows a permanent, non-alarming message ("This is an older article that predates the current site design") with no "refresh" call to action, since refreshing can never fix it. A `schemaVersion` field that's present but doesn't match the expected value indicates a genuine transient deploy-skew case — for this case, `renderArticle()` shows the "please refresh" message, since refreshing may well fix it. Reusing one "please refresh" message for both cases (as an earlier draft of this plan did) would give a dead-end, misleading message on every single visit to an old archived entry, forever.
- **`headline` fallback lives at the consumption boundary, not in the schema**: pre-redesign archive entries simply lack `headline`/`sections`. Rather than making these fields optional in the validator (which would weaken the contract for all *new* data), the fallback (`headline || consensus`) lives specifically in the two places that read archive data outside of full validated rendering — `js/front-page.js`'s beat cards and the related-beats strip's candidate list — consistent with the origin document's scope boundary. Both places apply the identical fallback rule.
- **Extract a shared `js/beat-discovery.js` module** rather than duplicating `front-page.js`'s existing per-beat fetch loop three times across `front-page.js`, `beat-page.js`, and `search-page.js`. Its per-beat summary object includes `{slug, label, headline, consensus, generatedAt, disagreementGroups}` — `disagreementGroups` is included from the start (not deferred) because both the front-page card's R8 indicator (Unit 5) and, potentially, a related-strip indicator need it; deferring it would let Unit 5 be written against a summary shape that can't support its own requirement.
- **Related-beats selection rule: first N in `beats.json` order, excluding the current beat**: simplest deterministic rule consistent with the origin document's explicit non-goal ("not a relevance recommender"). No recency sort or randomization needed.
- **Related-beats strip lives in its own module, `js/related-strip.js`**: a navigation strip is a distinct concern from synthesis rendering, and the codebase's own convention is single-purpose files (`rss.js`, `beat-matching.js`, `archive-index.js`, this plan's own `beat-discovery.js`) rather than growing one file to cover multiple concerns. `render-article.js` gains real complexity in this plan already (headline, sections, schemaVersion fallback, R8); adding an unrelated navigation component to it would work against that same file's existing single-purpose pattern.
- **`framingLabel` renders as a plain bold text prefix, not a bordered/background pill**: a pill-style badge would visually compete with the R8 badge immediately above it on the page, reintroducing the "competing alarms" problem the origin document's shared-visual-language goal was meant to avoid. A quieter, plain-text treatment keeps R8 as the one "badge-like" signal on the page, with section-level framing reading as a subtler in-line cue.
- **R8 and disputed-sentence highlighting share one concrete visual anchor: the existing `--dissent` color token.** R8 is an icon + text pill, the disputed-sentence cue is a dotted underline — different shapes for different contexts (page-level vs. inline), but both use `--dissent` as their color, which is the specific, checkable form of "one consistent visual language" the origin document asked for.
- **Front-page R8 indicator position**: directly following the headline text on the beat card, wrapping to its own line if the card is too narrow — consistent, simple placement rather than a bespoke card-specific layout decision.
- **Interactive vs. static `.disagreement-indicator` states**: the shared class carries the icon/color/shape styling; a modifier class (`.disagreement-indicator--link`) is added only on the article page's clickable instance to carry hover/focus-visible states, so the front-page's static pill never looks interactive and the article-page's real link is keyboard-accessible.
- **Non-color disagreement cue**: disputed sentences get a dotted underline in addition to color (`text-decoration: underline dotted`, reusing `--dissent`). Section-level framing labels are inherently non-color already (paired text, e.g. "One perspective:" / "Another angle:"), so no additional icon is needed there.
- **R8's Snapshot-panel anchor**: `renderArticle()` gives the Snapshot panel a stable `id="snapshot"`; the R8 indicator on the article page is an `<a href="#snapshot" class="disagreement-indicator disagreement-indicator--link">`. On the front-page card, R8 is a static `<span class="disagreement-indicator">` (not independently clickable) since the whole card is already a link to the article page.

## Open Questions

### Resolved During Planning

- **Exact prompt wording for sections/floor-of-1**: `schema/build-prompt.js`'s prompt text is updated in Unit 1 to describe the `headline`/`sections[]`/`schemaVersion` shape explicitly, including the 2-4 target / floor-of-1 rule and an instruction not to pad thin stories.
- **Data shape for per-sentence/per-section disagreement marking**: each sentence gets a `disputed: boolean`; each section gets an optional `framingLabel: string | null`. Both are asserted directly by the validator (Unit 1) rather than derived after the fact.
- **Non-color visual treatment**: dotted underline for disputed sentences; paired plain-text labels for section-level framing; icon+text pill for R8 (see Key Technical Decisions).
- **Related-beats selection rule, shared vs. per-page discovery code, and module placement**: shared `js/beat-discovery.js` module (Unit 2) plus a dedicated `js/related-strip.js` module (Unit 6); first-N-in-config-order selection.
- **Atomic-deploy enforcement mechanism**: `schemaVersion` field, validated by both producers and checked by the renderer, distinguishing missing-entirely (permanently old) from present-but-wrong (transient skew) — see Key Technical Decisions. Execution sequencing (ship Units 1 and 3 together) is the actual enforcement; `schemaVersion` is the detection mechanism for whatever gap remains.
- **Section subheading heading level**: `<h3>`, beneath the page's existing `<h1>`/document-title convention.
- **Front-page R8 indicator clickability and position**: static (non-clickable) pill, positioned directly after the headline text.
- **`framingLabel` visual form and R8/R4 shared visual language**: plain bold text prefix for `framingLabel` (not a pill); `--dissent` color token shared between R8 and the disputed-sentence cue as the concrete visual anchor (see Key Technical Decisions).

### Deferred to Implementation

- Exact `schemaVersion` integer value and the two fallback messages' literal copy — trivial wording, decided at implementation time.
- Exact icon glyph/SVG used for the R8 pill — a visual-polish choice with no product impact, left to implementation.

## High-Level Technical Design

> *This illustrates the intended data shape and signal logic for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

New synthesis JSON shape (directional sketch):

```
{
  schemaVersion: 2,
  headline: "...",
  query, consensus, sourceList: [...],       // unchanged
  sections: [
    {
      subheading: "...",
      framingLabel: "One perspective:" | null,
      sentences: [ { text, sources: [...], disputed: true|false } ]
    }
  ],
  disagreementGroups: [ ... ]                 // unchanged shape
}
```

Signal display logic (which disagreement signal shows, and when):

| Condition | R5 Snapshot panel | R8 indicator (front page + article) |
|---|---|---|
| `disagreementGroups.length === 0` | Scoped copy: "No disagreement detected among sources reviewed" | Absent |
| `disagreementGroups.length > 0` | Existing consensus + disagreement-group listing | Present, same `--dissent`-anchored visual language as R4 |

`renderArticle()`'s top-level dispatch, before any of the above (directional sketch, not implementation):

| `data.schemaVersion` | Behavior |
|---|---|
| `undefined` (field entirely absent) | Permanent "older article format" message — no refresh prompt |
| present, `!== EXPECTED_VERSION` | Transient "please refresh" message |
| `=== EXPECTED_VERSION` | Normal rendering (headline, sections, R8, Snapshot panel, per table above) |

Both R5's branch and R8's presence read the same underlying condition (`disagreementGroups.length > 0`) so the two can never contradict each other on one page, per the origin document's explicit requirement.

## Implementation Units

- [x] **Unit 1: Shared synthesis schema, prompt, and validator**

**Goal:** Replace `narrative[]` with `headline` + `sections[]` in the validated contract, add `schemaVersion`, and update the prompt that instructs Claude to produce this shape.

**Requirements:** R1, R2, R4 (data shape), R5 (data shape)

**Dependencies:** None — this is the foundation unit. **Must be merged and deployed in the same change as Unit 3 — see Execution Sequencing in Overview.**

**Files:**
- Modify: `schema/validate-synthesis.js`
- Modify: `schema/validate-synthesis.test.js`
- Modify: `schema/build-prompt.js`
- Modify: `schema/build-prompt.test.js`
- Modify: `scripts/lib/synthesize.test.js` — update the `validResult` fixture to the new shape, **and** change the validation-failure test's invalidating override from `{ ...validResult, narrative: [] }` to a `sections`-based violation (e.g. `{ ...validResult, sections: [] }`), since the old override targets a field that will no longer exist and would otherwise silently stop testing anything.
- Modify: `worker/src/handler.test.js` (update the `validResult` fixture to the new shape)
- Modify: `data/sample-beat/2026-07-24T12-00-00-000Z.json` (dev fixture, regenerated to new shape)
- Modify: `data/sample-beat.test.js` (assertions updated for new fixture shape)

**Approach:**
- Add `schemaVersion` (integer constant) as a required top-level field; validator rejects a missing or mismatched value with a clear error naming expected vs. actual.
- Replace `narrative` validation with `sections` validation: non-empty array (floor of 1), each entry requires a non-empty `subheading`, a non-empty `sentences` array (`text` non-empty, `sources` non-empty and cross-checked against `sourceList` exactly as `narrative` was before, `disputed` boolean), and an optional `framingLabel` (string or `null`).
- `disagreementGroups` and `sourceList` validation logic carry forward unchanged.
- Carry forward the existing non-object/`null`-entry guards (added in an earlier code-review fix) for the new `sections`/`sentences` arrays, so malformed LLM output still produces a clean validation error rather than a thrown exception.
- Prompt update explicitly states the 2-4 section target, the floor-of-1 rule with an explicit "don't pad thin stories" instruction, and the full new JSON shape including `schemaVersion`, `disputed`, and `framingLabel`.

**Patterns to follow:**
- `schema/validate-synthesis.js`'s existing accumulator-style `{valid, errors[]}` pattern and its existing non-object entry guards.
- `schema/build-prompt.js`'s existing branch between the articles-provided and web-search prompt variants — both variants need the new shape instructions.

**Test scenarios:**
- Happy path: valid object with `schemaVersion`, `headline`, one section (no disputed sentences, no `framingLabel`), empty `disagreementGroups` -> valid.
- Happy path: valid object with multiple sections, some `disputed: true` sentences, a `framingLabel` set on one section, non-empty `disagreementGroups` -> valid.
- Edge case: exactly 1 section (floor case) -> valid.
- Edge case: `framingLabel` explicitly `null` vs. a non-empty string -> both valid.
- Error path: missing `schemaVersion` -> invalid, error names the missing field.
- Error path: `schemaVersion` present but wrong value -> invalid, error states expected vs. actual.
- Error path: missing or empty `headline` -> invalid.
- Error path: empty `sections` array -> invalid (floor of 1 enforced).
- Error path: a section missing `subheading` -> invalid.
- Error path: a sentence missing `disputed` or with a non-boolean value -> invalid.
- Error path: a sentence's `sources` references a name not present in `sourceList` -> invalid (regression check — carries forward existing behavior).
- Error path: a non-object entry inside `sections` or `sentences` -> invalid with a clean error, not a thrown exception (regression check for the earlier fix).
- Prompt builder — happy path: articles provided -> prompt includes article content and the full new shape spec including `schemaVersion`.
- Prompt builder — happy path: no articles (web-search branch) -> prompt instructs web search and still requires the full new shape.
- Prompt builder — regression: prompt still includes the disagreement-preservation rule and raw-JSON-only instruction from the current implementation.
- Producer regression: `scripts/lib/synthesize.test.js`'s validation-failure test (using the updated `sections: []` override) still throws as expected.

**Verification:**
- `node --test schema/*.test.js data/*.test.js` passes.
- `node --test scripts/lib/synthesize.test.js` passes against the updated fixture and updated invalidation override.
- `cd worker && node --test src/handler.test.js` passes against the updated fixture.

---

- [x] **Unit 2: Shared beat-discovery module**

**Goal:** Extract the beat-summary-loading logic already in `front-page.js` into a shared, reusable module, so `beat-page.js` and `search-page.js` (Unit 6) don't reimplement it.

**Requirements:** R7 (shared plumbing), R6 (front-page reuse)

**Dependencies:** Unit 1 (consumes the new `headline`/`disagreementGroups` fields when building summaries).

**Files:**
- Create: `js/beat-discovery.js`
- Create: `js/beat-discovery.test.js`
- Modify: `js/front-page.js` (use the shared loader instead of its own inline fetch loop)

**Approach:**
- `loadBeatSummaries(beats, fetchImpl = fetch)` fetches each beat's `index.json` + latest entry, resolving `null` for any beat whose fetch fails (mirrors `front-page.js`'s existing per-beat try/catch) rather than rejecting the whole batch. Each resolved summary is `{slug, label, headline, consensus, generatedAt, disagreementGroups}` — `disagreementGroups` is included unconditionally, since Unit 5's front-page R8 indicator needs it and deferring it would leave that requirement unsupported.
- `pickOthers(summaries, currentSlug, limit)` filters out `null` entries and the current slug, then returns the first `limit` remaining in original order — implements the Key Technical Decision's selection rule.
- `front-page.js` is refactored to call `loadBeatSummaries` for its own card list (no "current slug" exclusion needed there).

**Patterns to follow:**
- `js/front-page.js`'s existing per-beat `try { ... } catch { render fallback card }` loop — generalize this exact pattern into the shared module rather than inventing new error handling.
- `scripts/lib/rss.js`'s injectable `fetchImpl` parameter pattern, for testability without real network calls.

**Test scenarios:**
- Happy path: all beats resolve successfully -> `loadBeatSummaries` returns a full array of summaries (including `disagreementGroups`) in input order.
- Edge case: one beat's fetch fails -> that entry is `null`, other entries are still correct.
- Edge case: empty `beats` array -> returns an empty array.
- `pickOthers` — happy path: excludes the current slug, returns the first N remaining in order.
- `pickOthers` — edge case: fewer than N others available -> returns what's available, no padding or error.
- `pickOthers` — edge case: no others available -> returns an empty array.
- `pickOthers` — edge case: `null` entries (failed beats) are excluded from consideration.

**Verification:**
- `node --test js/beat-discovery.test.js` passes.
- Manual browser check: front page still renders identically to before the refactor (no behavior change expected from this unit alone).

---

- [x] **Unit 3: Article renderer rewrite**

**Goal:** Render the new `headline` + `sections[]` shape, the shared R8 indicator, the softened Snapshot panel copy, and a graceful two-way `schemaVersion` fallback (permanently-old vs. transiently-mismatched).

**Requirements:** R1, R2, R3, R4, R5, R8

**Dependencies:** Unit 1 (new schema shape to render against). **Must be merged and deployed in the same change as Unit 1 — see Execution Sequencing in Overview.**

**Files:**
- Modify: `js/render-article.js`
- Modify: `js/render-article.test.js`

**Approach:**
- `renderArticle(data)` dispatches first on `schemaVersion`: if the field is entirely absent, return the permanent "older article format" fallback fragment (no refresh prompt); if present but not equal to the expected constant, return the transient "please refresh" fallback fragment; otherwise proceed to normal rendering. Neither fallback path attempts to read `sections`/`headline`.
- Renders `headline` as the article's top-level heading, with the R8 indicator (`<a href="#snapshot" class="disagreement-indicator disagreement-indicator--link">`, icon + "Sources disagree" text) shown immediately after it only when `disagreementGroups.length > 0`.
- Renders each section: `<h3>` subheading, optional `framingLabel` as a plain bold text prefix when present, paragraph(s) built from `sentences` (disputed sentences get the `--dissent` color + dotted-underline treatment; non-disputed sentences render plain), followed by a quiet per-section source list line (outlet names only, no chips). A `framingLabel` and a disputed sentence within the same section are independent and both render — neither suppresses the other.
- Snapshot panel gets `id="snapshot"` as the R8 anchor target; renders the softened "No disagreement detected among sources reviewed" copy when `disagreementGroups` is empty, otherwise the existing consensus + disagreement-group listing.
- All dynamic text continues through `escapeHtml` before interpolation, extending the existing XSS-safety discipline to the new fields (`headline`, `subheading`, `framingLabel`, per-sentence `text`).

**Patterns to follow:**
- The existing `escapeHtml`-everywhere discipline already in this file.
- The existing `chipClass`-style helper-function decomposition (small named render helpers per concern) rather than one large template function.

**Test scenarios:**
- Happy path: valid data with 2 sections (mixed disputed/non-disputed sentences), non-empty `disagreementGroups` -> headline, R8 indicator, both sections with subheadings + source lists, Snapshot panel all present and correctly populated.
- Happy path: valid data with empty `disagreementGroups` -> R8 indicator absent, Snapshot shows the softened no-disagreement copy, `#snapshot` anchor target still present.
- Edge case: single section (floor-of-1) -> renders correctly with no assumption of multiple sections.
- Edge case: two or more sections each carrying a paired `framingLabel` for the same cross-section disagreement -> both/all labels render (regression guard against one side silently dropping and the other reading as the neutral default).
- Edge case: a single section with both a `framingLabel` set AND one of its sentences marked `disputed` -> both signals render together; neither is suppressed by the other.
- Edge case: `data.schemaVersion` entirely absent -> the permanent "older article format" fallback renders, with no refresh prompt and no attempt to read `sections`/`headline`.
- Edge case: `data.schemaVersion` present but not equal to the expected constant -> the transient "please refresh" fallback renders, distinct from the absent-field case above.
- Error path (regression): malicious/HTML-bearing text in `headline`, `subheading`, `framingLabel`, or sentence `text` -> escaped in output, extending existing injection-prevention tests to the new fields.

**Verification:**
- `node --test js/render-article.test.js` passes.
- Manual browser check against a hand-built fixture matching the new schema (mirrors the original fixture-driven front-end development approach), before proceeding to Units 5-6.

---

- [x] **Unit 4: CSS for the new visual language**

**Goal:** Style the headline, sections, per-section source lists, disputed-content cues, the shared R8 indicator (both its static and interactive forms), framing labels, and the related-beats strip.

**Requirements:** R2, R3, R4, R5, R7, R8 (visual treatment)

**Dependencies:** Unit 3 (defines the class names/markup structure for headline/sections/R8/Snapshot panel) and Unit 6 (defines the related-strip markup this also styles).

**Files:**
- Modify: `css/style.css`

**Approach:**
- New classes: `.headline`, `.disagreement-indicator` (shared base — icon, `--dissent`-anchored color, pill shape) with a `.disagreement-indicator--link` modifier adding hover/focus-visible states for the article page's clickable instance only (the front-page's static instance uses the base class alone, with no interactive styling), `.section`, `.section-subheading`, `.framing-label` (plain bold text treatment, not a pill/badge), `.disputed-sentence` (color + dotted underline, reusing `--dissent`), `.section-sources`, `.related-strip`/`.related-strip-item`.
- Reuse the existing `--agree`/`--dissent` custom properties rather than introducing new color tokens.
- No new breakpoints introduced (per Scope Boundary); narrow-viewport behavior of each new component is manually verified during Unit 6, not via a new responsive framework.

**Test scenarios:**
- Test expectation: none — pure styling with no behavioral logic to test.

**Verification:**
- Visually confirmed during Units 3, 5, and 6's manual browser checks, including a narrow-viewport pass and a keyboard-focus pass over the article page's R8 link.

---

- [x] **Unit 5: Front-page integration**

**Goal:** Show the headline (with fallback), the shared R8 indicator, on front-page beat cards.

**Requirements:** R6, R8

**Dependencies:** Unit 1 (new fields), Unit 2 (shared loader), Unit 3 (shared `escapeHtml`/visual language), Unit 4 (styling).

**Files:**
- Modify: `js/front-page.js`
- Modify: `index.html` (only if the card template needs a new container element — likely a small inline addition, not a structural change)

**Approach:**
- Beat cards use `latest.headline` when present, falling back to `latest.consensus` for pre-redesign entries that lack it (per Scope Boundary) — never rendering a missing/blank value.
- Cards show the R8 indicator (static `<span class="disagreement-indicator">`, non-clickable, since the whole card is already a link), positioned directly after the headline text, when `latest.disagreementGroups?.length > 0`.

**Patterns to follow:**
- `js/render-article.js`'s `escapeHtml` for all dynamic text (already imported today).

**Test scenarios:**
- Happy path: beat with a new-shape latest entry and non-empty `disagreementGroups` -> card shows headline + indicator, positioned after the headline text.
- Happy path: beat with a new-shape latest entry and empty `disagreementGroups` -> card shows headline, no indicator.
- Edge case (regression guard): beat with an old-shape (pre-redesign) entry lacking `headline` -> card falls back to `consensus` text, no crash, no literal "undefined" text rendered.
- Error path (regression): per-beat fetch failure -> existing muted placeholder card behavior preserved unchanged.

**Verification:**
- Manual browser check against fixture data covering both a new-shape and an old-shape entry side by side (consistent with this file's existing manual-verification pattern — it has no dedicated automated test file today).

---

- [x] **Unit 6: Beat page and search page integration**

**Goal:** Wire the related-beats strip (R7) into both pages via a dedicated module, and confirm the R8 anchor-link behavior works end-to-end.

**Requirements:** R7, R8 (interaction)

**Dependencies:** Units 1-4 (schema, shared loader, renderer, styling all in place).

**Files:**
- Modify: `js/beat-page.js`
- Modify: `js/search-page.js`
- Modify: `beat.html` (container element for the related-strip)
- Modify: `search.html` (container element for the related-strip)
- Create: `js/related-strip.js` (exports `renderRelatedStrip(summaries)`; a distinct concern from synthesis rendering, kept out of `render-article.js` per Key Technical Decisions)
- Create: `js/related-strip.test.js`

**Approach:**
- Both pages call the shared `js/beat-discovery.js` module (Unit 2) to load candidates: `beat-page.js` excludes the current beat via `pickOthers`; `search-page.js` has no current beat, so it shows the first 3 tracked beats overall.
- `renderRelatedStrip(summaries)` applies the same `headline || consensus` fallback rule as Unit 5's front-page cards, for any candidate beat still on a pre-redesign entry — this is the same fallback, applied at a second consumption point, not a new decision.
- The strip renders after the Snapshot panel, as a simple horizontal list of headline links, omitted entirely when zero other beats are available.
- The R8 indicator's anchor (`href="#snapshot"`) resolves correctly automatically, since both pages already render through `renderArticle()`'s output (Unit 3), which now includes the `#snapshot` id.

**Patterns to follow:**
- `js/beat-page.js`'s existing history-strip rendering as a structural analog for a small, self-contained "list of links below the main content" component.
- Unit 5's `headline || consensus` fallback, applied identically here.

**Test scenarios:**
- Happy path: beat page with 2 other beats available -> strip shows 2 links with correct hrefs to those beats' article pages.
- Edge case: current beat is the only tracked beat -> strip is omitted entirely (no empty container, no placeholder text).
- Edge case: search page (no current beat) -> strip shows the first 3 tracked beats overall.
- Edge case (regression guard, mirrors Unit 5): a candidate beat's latest entry is old-shape and lacks `headline` -> strip falls back to that beat's `consensus` text, no crash, no literal "undefined" text.
- Error path: one other beat's data fails to load -> silently skipped (via Unit 2's `null`-filtering), strip still renders with the remaining beats.
- Integration: clicking the R8 indicator's anchor link scrolls to the Snapshot panel — verified manually in a browser (not unit-testable without a DOM/browser environment).

**Verification:**
- `node --test js/related-strip.test.js` passes.
- Manual browser click-through on both `beat.html` and `search.html`, confirming strip presence/absence logic, the headline-fallback case, and the R8 anchor-link behavior.

## System-Wide Impact

- **Interaction graph:** `schema/` changes (Unit 1) ripple to both producers (`scripts/lib/synthesize.js`, `worker/src/handler.js`, unchanged themselves — they just pass through whatever the shared prompt/validator produce) and to the front-end (`js/render-article.js`, `js/front-page.js`, `js/related-strip.js`). One edit point, multiple consumers — consistent with the existing architecture, not a new pattern. This is precisely why Units 1 and 3 cannot ship independently (see Execution Sequencing).
- **Error propagation:** a `schemaVersion` mismatch is now a first-class, user-visible-but-graceful failure mode on the front-end (Unit 3) rather than an unhandled crash or silently broken layout — and is split into two distinct messages (permanent vs. transient) rather than one message misapplied to both. Producer-side validation failure behavior (logged/skipped for the scheduled job, 502 for the Worker) is unchanged.
- **State lifecycle risks:** `data/*/` will contain a permanent mix of old-shape and new-shape archive entries, since no migration is planned. Every consumer touching archive data directly (front-page card, related-strip, and now the full article view via its permanent-fallback message) must tolerate this mix indefinitely, not just at launch.
- **API surface parity:** the Worker's HTTP response body shape changes (new fields, same producer code). `js/search-page.js` gets this automatically through the same `renderArticle()` path as `js/beat-page.js` — no Worker-specific front-end change needed beyond Unit 1's shared schema/prompt update.
- **Integration coverage:** the full round-trip (prompt -> Claude -> `extractJson` -> `validateSynthesis` -> `renderArticle`) is provable end-to-end only via the fake-client-based producer tests (Unit 1) plus a manual live-deploy verification pass after shipping, consistent with how the original build was verified.
- **Unchanged invariants:** RSS fetching (`scripts/lib/rss.js`), beat matching (`scripts/lib/beat-matching.js`), archive indexing (`scripts/lib/archive-index.js`), the Worker's shared-secret auth and KV rate-limiting, and the GitHub Actions workflow's git-commit step are untouched by this plan.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Landing Unit 1 in production without Unit 3 breaks the live article view for every entry produced in the gap (scheduled job writes, live search responses) | Explicit execution-sequencing requirement (Overview): implement and deploy Units 1 and 3 together, on a branch, without letting the scheduled job run against a partially-updated `main` |
| `schemaVersion` mismatch reused one "please refresh" message for both transient skew and permanently-old archive entries | Two distinct fallback messages, dispatched on whether the field is absent (permanent) vs. present-but-wrong (transient) — see Unit 3 |
| Claude doesn't reliably produce accurate `disputed`/`framingLabel` judgments | Accepted risk per origin document; the validator enforces structural correctness only, not semantic accuracy |
| Old archive data lacks new fields indefinitely (no migration planned) | Explicit fallback paths in the front-page card (Unit 5) and related-strip (Unit 6), plus a dedicated non-alarming message in the full article view (Unit 3) |
| New CSS components have no tested responsive behavior (the codebase has zero media queries today) | Manual narrow-viewport check during Units 4 and 6 verification, per the origin document's corrected scope boundary |

## Documentation / Operational Notes

- After this ships, consider running `compound-engineering:ce-compound` to document the schema-versioning pattern used here for a shared multi-producer contract — `docs/solutions/` doesn't exist in this repo yet, and this is a genuinely reusable pattern for future contract changes.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-07-24-perplexity-style-article-redesign-requirements.md](docs/brainstorms/2026-07-24-perplexity-style-article-redesign-requirements.md)
- Related code: `schema/validate-synthesis.js`, `schema/build-prompt.js`, `js/render-article.js`, `js/front-page.js`, `js/beat-page.js`, `js/search-page.js`, `scripts/lib/synthesize.js`, `worker/src/handler.js`, `css/style.css`
