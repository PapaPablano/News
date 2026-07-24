# News Synthesis App — Design

## Problem

Perplexity-style multi-source news summaries have four recurring problems for this user:

1. Opaque about which source said what.
2. Synthesis flattens interesting disagreements between outlets into bland consensus.
3. No control over which outlets/feeds are eligible sources.
4. Not built around the user's own tracked topics/beats.

This project is a personal, GitHub Pages–hosted news app that fixes all four: transparent inline citations, an explicit disagreement panel, a user-curated source list, and a saved-beats front page — plus an ad-hoc search box for one-off queries.

## Architecture

Three pieces, all free-tier:

- **Static front-end** (GitHub Pages) — plain HTML/CSS/JS, same hosting pattern as the user's existing "Pop List" project. Reads pre-built JSON files for the beats front page and calls the Cloudflare Worker directly for ad-hoc search.
- **GitHub Actions scheduled workflow** — runs on a cron schedule, reads `beats.json` + `sources.json` from the repo, fetches RSS (Google News + curated outlet feeds), calls the Anthropic API (key stored as a GitHub Actions secret, never exposed client-side) to synthesize each beat, and commits the result as a new dated JSON entry per beat. GitHub Pages serves those static files — no live API key in the browser for this path.
- **Cloudflare Worker** — small proxy holding the Anthropic API key as a Worker secret. The front-end's search box POSTs a query to the Worker; the Worker calls Claude live (web search enabled) and returns a synthesized result in the same JSON shape as the archive files.

This split keeps the API key out of the browser for all scheduled content, and confines live browser-triggered API calls to one small, purpose-built proxy used only for ad-hoc search.

## Components

- **`sources.json`** — curated list of RSS feeds: `{name, feedUrl}[]`. Edited directly in the repo.
- **`beats.json`** — saved topics/beats: `{slug, label, searchTerms}[]`. Edited directly in the repo.
- **`/data/<beat-slug>/<YYYY-MM-DD-HHmm>.json`** — archive of synthesized results per beat, one file per refresh, written by the Actions job. The front page reads the newest file per beat; each beat has a history view listing all its dated files.
- **Front-end views:**
  - *Front page* — one card per beat: label, latest snapshot's consensus line, last-updated timestamp. Click through to the article page.
  - *Article page* — inline annotated narrative (sentences with small colored citation chips per source; chip color indicates corroborating vs. dissenting framing) followed by a pinned "Snapshot" panel: a neutral one-line consensus statement plus a disagreement breakdown grouping sources by stance. Includes a history strip to browse past dated entries for that beat.
  - *Search page* — text input, POSTs to the Cloudflare Worker, renders the response through the same article-view renderer, labeled "live search" rather than a beat name.
- **GitHub Actions workflow** — scheduled trigger; script (Node or Python) reads config → fetches RSS → calls Anthropic API → validates output shape → writes/commits new JSON file per beat.
- **Cloudflare Worker** — single POST endpoint; holds `ANTHROPIC_API_KEY` as a secret; receives `{query}`; calls Claude with web search enabled; validates and returns the same structured JSON shape used by archive files.

### Synthesis output shape

Both producers (Actions job and Worker) must emit the same shape so one front-end renderer can consume either:

```json
{
  "generatedAt": "ISO-8601 timestamp",
  "query": "beat label or ad-hoc search text",
  "consensus": "one neutral sentence stating what's agreed on",
  "narrative": [
    { "text": "sentence or clause", "sources": ["AP", "Reuters"], "stance": "corroborating" },
    { "text": "sentence or clause", "sources": ["Local Tribune"], "stance": "dissenting" }
  ],
  "disagreementGroups": [
    { "stance": "Framed as relief", "sources": ["NYT", "AP"] },
    { "stance": "Framed as a giveaway", "sources": ["WSJ op-ed", "Local Tribune"] }
  ],
  "sourceList": [
    { "name": "AP", "url": "https://..." }
  ]
}
```

`stance` on narrative entries is a simple binary (`corroborating` / `dissenting`) driving chip color; `disagreementGroups` is free-text stance labels for the snapshot panel, not a fixed enum. Source labels are outlet names only — no political-leaning/bias tags in v1.

## Data flow

**Scheduled beat refresh:**
1. Actions cron fires → script loads `beats.json` + `sources.json`.
2. For each beat: fetch Google News RSS for its search terms, plus each curated outlet's RSS; filter to articles relevant to the beat.
3. Send collected article text/links to Claude with a prompt instructing it to produce the structured JSON shape above, explicitly preserving disagreements between sources rather than smoothing them into a single blended take.
4. Validate the returned JSON against the expected shape.
5. Write to `/data/<beat-slug>/<YYYY-MM-DD-HHmm>.json`, commit and push. GitHub Pages redeploys on push; the front page picks up the new file on next load.
6. If the API call fails or output fails validation, the step fails without committing — the previous archive entry remains "latest." Visible as a failed run in the Actions tab.

**Ad-hoc search:**
1. User submits a query on the search page.
2. Front-end POSTs `{query}` to the Cloudflare Worker.
3. Worker calls Claude directly (web search tool enabled) with the same structured-output prompt.
4. Worker validates the response shape and returns it; front-end renders it through the same article-view component, tagged "live search."
5. On Worker error or shape validation failure, the front-end shows an inline "search failed, try again" message — no partial or malformed result is ever rendered.

## Error handling

- Individual RSS feed failures are logged and skipped; a beat refresh only fails if zero sources returned usable content.
- Anthropic API errors during the scheduled job fail that workflow step; no commit happens; prior archive entry stays current.
- Cloudflare Worker errors surface as an inline failure message on the search page.
- Malformed synthesis JSON (from either producer) is treated as a failure and never rendered — shape validation runs before writing (Actions) or returning (Worker).

## Testing / validation

No formal test suite planned given the project's scope (static site + two small scripts). Validation approach:

- A local dry-run script exercises the beat-refresh logic against a single beat without committing, for sanity-checking synthesis quality before wiring up the real cron schedule.
- Manual smoke test of the deployed Worker with a couple of real search queries after deploy.
- JSON-shape validation (described above) is the primary automated safeguard against bad data reaching the front-end.
- Before v1 is considered done: one full scheduled cycle is run end-to-end (Actions → commit → Pages redeploy → front page reflects it), and one live search is run end-to-end.

## Out of scope for v1

- Political-leaning/bias labels on sources.
- Reddit/forum discussion as a source type.
- In-browser settings UI for editing feeds/beats (config is repo-file-only for v1).
- Vercel or other alternative serverless hosting for the live-search proxy (Cloudflare Workers only).
