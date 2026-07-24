---
date: 2026-07-24
topic: perplexity-style-article-redesign
---

# Perplexity-Style Article Redesign

## Problem Frame

The current article rendering (`js/render-article.js`, driven by `schema/validate-synthesis.js`'s flat `narrative[]` array) reads like a structured data dump: a list of individual sentences, each followed by a small colored source chip. A side-by-side comparison against Perplexity's Discover page for the same real story (LeBron James signing with the 76ers) showed Perplexity producing a real headline, themed section subheadings, grouped citation badges, and short flowing paragraphs — a genuinely more polished reading experience.

The app's reason for existing is *not* to copy Perplexity wholesale — Perplexity's page showed no visible disagreement between sources on this story, while this app's whole differentiator is surfacing exactly that (a fact borne out by our own factual-accuracy stress test, which is a separate concern from this brainstorm). The goal here is to bring over Perplexity's writing structure and visual polish while keeping the existing consensus/disagreement Snapshot panel a first-class, prominent feature — not diluting it in pursuit of a prettier page.

Two document-review passes shaped this document significantly beyond the initial draft. The first surfaced the risk that polished, confident-reading prose plus a bottom-only panel could let a skimming reader miss disagreement entirely. The second, reviewing the fixes for that risk, caught that the fixes themselves needed tightening (an unspecified badge, an overclaiming "all agree" message, an unenforced deploy-atomicity decision). Both passes are folded into the requirements below rather than tracked separately.

## Requirements

**Content Structure**
- R1. Synthesis output includes a generated `headline` (single, news-headline-style sentence) in addition to the existing `consensus` line.
- R2. Body content is organized into themed sections, each with its own subheading and a short block of flowing prose (target: roughly 2-4 sentences per section). 2-4 sections is the target range for typical stories; a thin/simple story may have as few as 1 section — this is a firm floor, not just a soft aspiration, and Claude should never pad a simple story with repetitive sections just to hit a higher count.

**Citation & Disagreement Display**
- R3. Each section shows its contributing sources once, as a quiet, non-color-coded source list — not a chip after every sentence.
- R4. Sentences that are part of an actual cross-source disagreement get a visible stance highlight using both color and a secondary non-color cue (e.g. a distinct underline or border style), so the signal doesn't depend on color perception alone; sentences where sources agree are visually quiet/unmarked. When a disagreement is really between sections (different sections emphasizing different angles) rather than between sentences within one section, **all** sections party to that disagreement get a matching, paired framing label (e.g. "One perspective:" / "Another angle:") — never just one side, which would make the unlabeled section read as the neutral/default account. A section's framing label and a sentence-level highlight are independent signals and can both appear in the same section when applicable; neither suppresses the other. If most or all sections of a story legitimately warrant a framing label, that itself is an accurate signal (a highly contested story), not a design failure to cap or avoid.
- R5. The consensus/disagreement Snapshot panel remains a first-class, clearly visible part of the article — restyled to match the new visual language, but never shrunk, buried, or removed. When there is no disagreement to report (`disagreementGroups` is empty), the panel shows a clear but appropriately scoped statement (e.g. "No disagreement detected among sources reviewed") rather than an empty placeholder or an overclaiming guarantee of verified consensus — the app doesn't promise it caught every possible dispute, just that it didn't find one.
- R8. Both the front-page beat card (R6) and the full article page show a small disagreement indicator whenever a story has any disagreement to report, positioned near the headline in both places (above the fold on the article page). It shares the same visual language (icon/cue) as R4's non-color disputed-sentence cue, so a reader learns one consistent "disagreement" signal across the whole app. It is a clickable anchor link to the Snapshot panel on the article page. R5's "no disagreement" framing and R8's indicator key off the same single underlying condition (disagreementGroups being non-empty) so the two can never contradict each other on the same page.

**Front Page**
- R6. Beat cards on the front page (`index.html`/`js/front-page.js`) show the generated headline in place of the current consensus-sentence preview, plus the shared disagreement indicator from R8 when relevant.

**Related Beats Strip**
- R7. The beat article page and the live search-results page each show a strip of up to 3 other tracked beats' latest headlines ("More from your beats") as a simple horizontal list of headline links, positioned after the Snapshot panel, linking through to those beats' article pages. If fewer than 1 other beat has data available, the strip is omitted entirely rather than shown empty. If an individual other beat's data fails to load, that beat is silently skipped from the strip (consistent with how `front-page.js` already handles a per-beat fetch failure today) rather than breaking the whole strip.

## Success Criteria

- Reading a beat article or a search result feels like reading a short piece of real journalism (headline, sectioned prose) rather than a bulleted list of tagged facts.
- The Snapshot panel is at least as easy to find and read as it is today — the redesign must not make the app's core differentiator less visible.
- A reader who only skims the front page or the article's headline and prose still gets a cue when sources disagree, via the shared R8 indicator, even if they never scroll or click through.
- The visual design (typography, spacing, citation styling) reads as noticeably more polished/editorial than the current inline-chip presentation.

## Scope Boundaries

- **Not addressing factual/numeric accuracy.** The LeBron-contract-terms discrepancy surfaced during testing (differing dollar figures across sources) is a distinct problem from writing structure and visual design, and is explicitly out of scope for this pass.
- **No backward compatibility.** Existing archived JSON entries in the old flat-`narrative[]` shape are not migrated and will not render correctly under the new schema — acceptable given this is a low-traffic personal app with only a couple of real archive entries so far. This applies wherever a `headline` field is read from possibly-old data: the front-page card (R6) falls back to the old `consensus` text, and the related-beats strip (R7) does the same for any other beat still on a pre-redesign entry, rather than either one displaying missing/blank content.
- **No political-leaning/bias labeling** (already out of scope for this app per its original design — unchanged).
- **The related-beats strip is not a topic-similarity recommender.** It surfaces other beats the user already tracks, not content chosen by relevance to the current article.
- **Not attempting to fix Claude's underlying disagreement-detection reliability.** If Claude fails to notice a genuine dispute, it will look identical to true consensus under the new quiet-by-default display. This is a pre-existing model-reliability risk, not something this redesign's display logic can solve — see Key Decisions. R5's softened wording (see above) is a direct consequence of accepting this risk honestly rather than overclaiming certainty.
- **No new responsive breakpoints as a design goal, but the underlying claim needs a caveat.** `css/style.css` today has no media queries at all — its current mobile-friendliness is incidental single-column fluidity, not a deliberate, tested responsive system. The redesign doesn't plan to introduce a new breakpoint system, but planning/implementation should verify each new component (R8's indicator, the R7 strip, section subheadings) actually behaves reasonably at narrow viewports rather than assuming an established convention will cover them.

## Key Decisions

- **Sections over a flat sentence list**: chosen to match Perplexity's actual structure and produce more natural, readable prose. The user confirmed both writing structure *and* visual design matter equally, and specifically named section subheadings as the desired shape.
- **Snapshot panel stays structurally prominent, not dissolved into prose**: this is the app's core differentiator versus Perplexity and must survive the redesign undiminished, even though Perplexity's own page has no equivalent.
- **Per-section source lists + disagreement-only inline highlighting** (rather than a chip on every sentence): makes agreement visually quiet and disagreement visually loud — a more informative signal than uniform per-sentence chips, and less visually noisy now that content reads as prose rather than a list. **Trade-off accepted deliberately**: an agreeing sentence's specific source is now only visible via its section's source list, not the sentence itself. Disputed sentences still carry their own visible cue (R4), so the app's core transparency promise is unaffected; only per-claim sourcing for *agreed* content gets coarser.
- **Shared disagreement indicator (R8) on both the front page and the article page**: the front page is the app's highest-skim surface — a list of headlines scanned before ever clicking through — so a skimming-safety-net indicator that only lived on the article page would miss the point at the level where skimming happens most. Reusing one shared visual language for R4, R5, and R8 (rather than three independently-styled signals) keeps the top of the page from feeling like competing alarms.
- **R5's no-disagreement copy is scoped, not affirmative**: softened from an earlier draft's "Sources are in full agreement" to "No disagreement detected among sources reviewed," so the panel doesn't read as a verified guarantee when the underlying detection is accepted as imperfect (see Scope Boundaries).
- **Cross-section disagreement gets symmetric, paired framing labels**: real disagreement more often shows up as different sections emphasizing different angles than as two sentences side by side. Labeling only one side would implicitly cast the unlabeled section as the neutral truth, so all sections party to one disagreement get matching labels.
- **Quiet-by-default detection risk is accepted, not mitigated, in this pass**: this is a pre-existing model-reliability question, not a new one introduced by this redesign's display logic, and solving it is out of scope here — revisit if it proves to be a real problem in practice.
- **No migration work for old archive entries**: the low cost of "just start fresh" beats building compatibility code for a couple of personal-use archive files (YAGNI).
- **Related-beats strip is a navigation convenience, not an engagement feature**: the actual reason to keep it is quick lateral movement between your own tracked topics without returning to the front page each time — not because a competitor has something similar.
- **Schema/prompt/validator/producer/renderer changes deploy as one atomic unit**: both producers (the scheduled job and the live Worker) and the renderer share the same JSON contract with no version negotiation between them, so a staged/partial rollout would let one half of the system read or write a shape the other half doesn't expect. Ship together in a single deploy window. Because nothing in the current deploy tooling (the GitHub Actions workflow has no reference to the Worker; the Worker deploys manually via `wrangler deploy` with no CI gate) mechanically enforces this for a solo developer working across sessions, planning should decide a concrete, lightweight enforcement mechanism (see Outstanding Questions) rather than relying on memory alone.

## Before / After (for planning reference)

| | Today | This redesign |
|---|---|---|
| Top of article | No headline; page title only | Generated `headline` as a real title, with a shared disagreement indicator (R8) alongside it when relevant |
| Body | Flat list of tagged sentences | 2-4 named sections for typical stories (floor of 1 for thin stories), each with subheading + flowing prose |
| Per-sentence citation | Colored chip after every sentence | Quiet per-section source list; color + non-color cue only on disputed sentences or sections |
| Snapshot panel | Bottom panel, consensus + disagreement groups | Same position/role, restyled, still prominent; scoped ("no disagreement detected") wording when there's none to show |
| Front-page card | Shows consensus sentence | Shows headline + shared disagreement indicator (R8); falls back to consensus for pre-redesign entries |
| Related content | None | "More from your beats" strip, up to 3 other beats, hidden if none available, individual failures skipped silently |

## Dependencies / Assumptions

- This changes the shared synthesis JSON contract (`schema/validate-synthesis.js`, `schema/build-prompt.js`) consumed by **both** producers (`scripts/lib/synthesize.js` for the scheduled job, `worker/src/handler.js` for live search) and **all three** front-end pages — verified directly against the current codebase, not assumed. `js/beat-page.js` and `js/search-page.js` both render through the shared `js/render-article.js`; `js/front-page.js` reads the JSON fields directly for its card preview (only `escapeHtml` is shared from `render-article.js`) and will need its own update for R6/R1/R8, not a free ride from a `render-article.js` change alone.
- Assumes Claude can reliably identify which specific sentences (or sections) are genuinely disputed across sources versus merely differently emphasized — the same underlying judgment the current per-sentence stance tagging already relies on, just applied within a section-and-prose structure instead of a flat list. The risk that this judgment is imperfect is accepted, not solved, in this pass (see Key Decisions, Scope Boundaries).
- Verify during planning/implementation that the chosen sections/sentences data shape actually delivers the "flowing paragraphs" feel promised in Success Criteria, and isn't just today's per-sentence chip relocated into a section wrapper.
- No baseline currently exists for how often today's per-sentence chip system actually surfaces disagreement versus how often the new model will. "As easy to find as today" (Success Criteria) is a judgment call at launch, not something measurable against a prior baseline.
- Implementing R7 requires per-beat data discovery (fetch `beats.json`, then each other beat's `index.json` + latest entry) on `beat-page.js` and `search-page.js`, which today only `front-page.js` does. Whether this becomes a shared module or is implemented per-page is a planning-level decision, not a product one.

## Outstanding Questions

### Deferred to Planning

- [Affects R2][Technical] Exact prompt wording for instructing Claude to produce sections with subheadings within the stated 2-4 target range and the floor-of-1 rule for thin stories.
- [Affects R3, R4][Technical] Data shape for marking which specific sentences (or whole sections) are part of a disagreement — e.g., a per-sentence `disputed: boolean` flag plus a per-section `framing` label, versus deriving both by cross-referencing `disagreementGroups`. Affects both the prompt and the validator, and should define one single shared condition (see R8) that both R5's and R8's display logic read from.
- [Affects R4, R8][Technical] Specific non-color visual treatment shared by disputed sentences and the R8 indicator (underline style, border, icon) — a design/CSS decision with no single obviously-correct answer, left to planning.
- [Affects R7][Technical] Selection rule for which "other beats" appear in the related-beats strip when more than 3 are available (recency, rotation, or random), and whether the R7 beat-discovery logic is extracted into one shared module or implemented per-page.
- [Affects R1-R6, R8][Technical] Planning should sequence the schema/prompt/validator change, both producer updates, and the renderer/CSS update as a single atomic deploy (see Key Decisions), decide a concrete lightweight enforcement mechanism for that atomicity (e.g. a schema-version field the renderer checks and gracefully rejects on mismatch, or a single combined deploy script/checklist covering both the Worker and the scheduled job), and confirm existing test suites (schema/*.test.js, js/render-article.test.js, scripts/lib/synthesize.test.js, worker/src/handler.test.js) are updated to match the new shape.
- [Affects R2][Technical] Section subheadings should use semantic heading markup appropriate for screen-reader navigation (e.g. `<h3>` beneath the page's existing `<h1>`/`<h2>` title convention) — exact markup left to planning.
- [Affects R8][Technical] Whether the front-page card's version of the R8 indicator is a clickable link (to the article page) or purely a visual cue, since "clickable anchor to the Snapshot panel" only applies cleanly on the article page itself — left to planning.

## Next Steps

-> `/ce:plan` for structured implementation planning
