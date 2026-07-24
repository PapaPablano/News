# News Synthesis App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal, GitHub Pages–hosted news app that synthesizes coverage of saved topics ("beats") from curated RSS sources plus Google News on a schedule, and answers ad-hoc searches live — always showing transparent per-sentence citations and an explicit disagreement panel instead of a blended take.

**Architecture:** A static front-end (GitHub Pages) reads pre-built JSON archive files produced by a scheduled GitHub Actions job (which fetches RSS, calls the Anthropic API, and commits results). A separate Cloudflare Worker holds the API key for live ad-hoc search and returns results in the same JSON shape, so one front-end renderer displays both.

**Tech Stack:** Plain HTML/CSS/JS (ES modules, no framework, no bundler), Node.js scripts for the scheduled job (`@anthropic-ai/sdk`, `fast-xml-parser`), Cloudflare Workers (`wrangler`) for the live search proxy, Node's built-in `node:test` runner for all automated tests, GitHub Actions for scheduling.

## Global Constraints

- Source labels are outlet names only — no political-leaning/bias tags in v1 (per spec).
- Config (feeds, beats) is repo-file-only for v1 — no in-browser settings UI.
- The live-search proxy uses Cloudflare Workers only — no alternative serverless hosting in v1.
- No Reddit/forum discussion source type in v1.
- The Anthropic API key must never be embedded in any file served to the browser (front-end code, committed JSON, or client bundles). It only ever lives in a GitHub Actions secret and a Cloudflare Worker secret.
- Both synthesis producers (the scheduled job and the Worker) must emit the exact JSON shape defined in Task 2, validated before being written or returned.

---

## File Structure

```
News/
├── package.json                    # root deps + test script (Task 1)
├── sources.json                    # curated RSS feed list (Task 1)
├── beats.json                      # saved topics/beats (Task 1)
├── schema/
│   ├── validate-synthesis.js       # shared output-shape validator (Task 2)
│   ├── validate-synthesis.test.js
│   ├── build-prompt.js             # shared Claude prompt builder (Task 3)
│   └── build-prompt.test.js
├── data/
│   └── sample-beat/
│       ├── index.json              # fixture archive index (Task 4)
│       └── 2026-07-24T12-00-00-000Z.json
├── js/
│   ├── render-article.js           # pure synthesis-JSON -> HTML renderer (Task 5)
│   ├── render-article.test.js
│   ├── front-page.js                # Task 6
│   ├── beat-page.js                 # Task 7
│   └── search-page.js               # Task 15
├── css/
│   └── style.css                    # Tasks 6/7/15
├── index.html                       # Task 6
├── beat.html                        # Task 7
├── search.html                      # Task 15
├── scripts/
│   ├── lib/
│   │   ├── rss.js                   # Task 8
│   │   ├── rss.test.js
│   │   ├── beat-matching.js         # Task 9
│   │   ├── beat-matching.test.js
│   │   ├── archive-index.js         # Task 10
│   │   ├── archive-index.test.js
│   │   ├── synthesize.js            # Task 11
│   │   └── synthesize.test.js
│   ├── refresh-beats.js             # Task 12
│   └── dry-run.js                   # Task 12
├── .github/
│   └── workflows/
│       └── refresh-beats.yml        # Task 13
└── worker/
    ├── package.json                 # Task 14
    ├── wrangler.toml                # Task 14
    └── src/
        ├── handler.js               # Task 14
        ├── handler.test.js
        └── index.js                 # Task 14
```

`schema/` is imported by both `scripts/lib/synthesize.js` (Node) and `worker/src/handler.js` (Cloudflare Worker) via relative paths — Wrangler's bundler resolves relative imports outside the `worker/` directory, so this stays a single source of truth for the prompt and the validator instead of two copies.

---

### Task 1: Repo scaffolding — package.json, sources.json, beats.json

**Files:**
- Create: `package.json`
- Create: `sources.json`
- Create: `beats.json`
- Create: `data/.gitkeep`

**Interfaces:**
- Produces: `package.json` declares `"type": "module"` (all later `.js` files are ES modules using `import`/`export`), dependencies `@anthropic-ai/sdk` and `fast-xml-parser`, and a `test` script.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "news-synthesis-app",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test schema/*.test.js data/*.test.js js/*.test.js scripts/lib/*.test.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.0",
    "fast-xml-parser": "^4.5.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: creates `node_modules/` and `package-lock.json`, no errors.

- [ ] **Step 3: Create `sources.json`**

```json
[
  {
    "name": "Reuters",
    "feedUrl": "https://feeds.reuters.com/reuters/topNews"
  }
]
```

This is a starter example — replace/extend with the outlets you actually want to track. Verify each feed URL still resolves before relying on it (RSS URLs occasionally change).

- [ ] **Step 4: Create `beats.json`**

```json
[
  {
    "slug": "sample-beat",
    "label": "Sample Beat (replace me)",
    "searchTerms": "example topic"
  }
]
```

Replace this with your real tracked topics once the pipeline works end-to-end. `slug` must be URL-safe (lowercase, hyphens) — it becomes both the `data/<slug>/` directory name and the `?beat=` query param.

- [ ] **Step 5: Create the data directory placeholder**

Create empty file `data/.gitkeep` (so the otherwise-empty `data/` directory is tracked by git before Task 4 adds real content into it).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json sources.json beats.json data/.gitkeep
git commit -m "chore: scaffold package.json, sources.json, beats.json"
```

---

### Task 2: Shared synthesis output validator

**Files:**
- Create: `schema/validate-synthesis.js`
- Test: `schema/validate-synthesis.test.js`

**Interfaces:**
- Produces: `validateSynthesis(obj) -> { valid: boolean, errors: string[] }`. Consumed by `scripts/lib/synthesize.js` (Task 11) and `worker/src/handler.js` (Task 14).
- The validated shape:
  ```
  {
    generatedAt: string (ISO-8601),
    query: string,
    consensus: string,
    narrative: [ { text: string, sources: string[], stance: "corroborating" | "dissenting" } ],
    disagreementGroups: [ { stance: string, sources: string[] } ],
    sourceList: [ { name: string, url: string } ]
  }
  ```
  Every source name referenced in `narrative[].sources` or `disagreementGroups[].sources` must also appear in `sourceList`.

- [ ] **Step 1: Write the failing test**

Create `schema/validate-synthesis.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { validateSynthesis } from "./validate-synthesis.js";

const validSample = {
  generatedAt: "2026-07-24T12:00:00.000Z",
  query: "Zoning change",
  consensus: "The council approved the zoning change 5-2.",
  narrative: [
    { text: "The council approved the change.", sources: ["AP"], stance: "corroborating" },
    { text: "Critics say it skipped public comment.", sources: ["Local Tribune"], stance: "dissenting" }
  ],
  disagreementGroups: [
    { stance: "Framed as relief", sources: ["AP"] },
    { stance: "Framed as a giveaway", sources: ["Local Tribune"] }
  ],
  sourceList: [
    { name: "AP", url: "https://example.com/ap" },
    { name: "Local Tribune", url: "https://example.com/tribune" }
  ]
};

test("accepts a fully valid synthesis object", () => {
  const { valid, errors } = validateSynthesis(validSample);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test("rejects a non-object", () => {
  const { valid, errors } = validateSynthesis(null);
  assert.equal(valid, false);
  assert.ok(errors.length > 0);
});

test("rejects an unparseable generatedAt", () => {
  const { valid, errors } = validateSynthesis({ ...validSample, generatedAt: "not-a-date" });
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("generatedAt")));
});

test("rejects an empty narrative array", () => {
  const { valid, errors } = validateSynthesis({ ...validSample, narrative: [] });
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("narrative")));
});

test("rejects a stance value outside the allowed set", () => {
  const bad = { ...validSample, narrative: [{ ...validSample.narrative[0], stance: "neutral" }] };
  const { valid, errors } = validateSynthesis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("stance")));
});

test("rejects a source referenced in narrative but missing from sourceList", () => {
  const bad = { ...validSample, narrative: [{ text: "x", sources: ["Unknown Outlet"], stance: "corroborating" }] };
  const { valid, errors } = validateSynthesis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("Unknown Outlet")));
});

test("accepts an empty disagreementGroups array", () => {
  const { valid } = validateSynthesis({ ...validSample, disagreementGroups: [] });
  assert.equal(valid, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test schema/validate-synthesis.test.js`
Expected: FAIL — `Cannot find module './validate-synthesis.js'`

- [ ] **Step 3: Write the implementation**

Create `schema/validate-synthesis.js`:

```js
const STANCES = new Set(["corroborating", "dissenting"]);

export function validateSynthesis(obj) {
  const errors = [];

  if (typeof obj !== "object" || obj === null) {
    return { valid: false, errors: ["root value must be an object"] };
  }

  if (typeof obj.generatedAt !== "string" || Number.isNaN(Date.parse(obj.generatedAt))) {
    errors.push("generatedAt must be a parseable ISO-8601 string");
  }
  if (typeof obj.query !== "string" || obj.query.length === 0) {
    errors.push("query must be a non-empty string");
  }
  if (typeof obj.consensus !== "string" || obj.consensus.length === 0) {
    errors.push("consensus must be a non-empty string");
  }

  const sourceListValid = Array.isArray(obj.sourceList);
  if (!sourceListValid) {
    errors.push("sourceList must be an array");
  }
  const knownSources = new Set((sourceListValid ? obj.sourceList : []).map(s => s && s.name));

  if (!Array.isArray(obj.narrative) || obj.narrative.length === 0) {
    errors.push("narrative must be a non-empty array");
  } else {
    obj.narrative.forEach((entry, i) => {
      if (typeof entry.text !== "string" || entry.text.length === 0) {
        errors.push(`narrative[${i}].text must be a non-empty string`);
      }
      if (!Array.isArray(entry.sources) || entry.sources.length === 0) {
        errors.push(`narrative[${i}].sources must be a non-empty array`);
      } else {
        entry.sources.forEach(s => {
          if (!knownSources.has(s)) errors.push(`narrative[${i}].sources references unknown source "${s}"`);
        });
      }
      if (!STANCES.has(entry.stance)) {
        errors.push(`narrative[${i}].stance must be "corroborating" or "dissenting", got ${JSON.stringify(entry.stance)}`);
      }
    });
  }

  if (!Array.isArray(obj.disagreementGroups)) {
    errors.push("disagreementGroups must be an array");
  } else {
    obj.disagreementGroups.forEach((group, i) => {
      if (typeof group.stance !== "string" || group.stance.length === 0) {
        errors.push(`disagreementGroups[${i}].stance must be a non-empty string`);
      }
      if (!Array.isArray(group.sources) || group.sources.length === 0) {
        errors.push(`disagreementGroups[${i}].sources must be a non-empty array`);
      } else {
        group.sources.forEach(s => {
          if (!knownSources.has(s)) errors.push(`disagreementGroups[${i}].sources references unknown source "${s}"`);
        });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test schema/validate-synthesis.test.js`
Expected: PASS — 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add schema/validate-synthesis.js schema/validate-synthesis.test.js
git commit -m "feat: add shared synthesis output validator"
```

---

### Task 3: Shared Claude prompt builder

**Files:**
- Create: `schema/build-prompt.js`
- Test: `schema/build-prompt.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `buildSynthesisPrompt({ topic: string, articles: Array<{source, title, snippet, url}> }) -> string`. Consumed by `scripts/lib/synthesize.js` (Task 11, called with real `articles`) and `worker/src/handler.js` (Task 14, called with `articles: []` so the prompt instructs Claude to use its own web search tool instead).

- [ ] **Step 1: Write the failing test**

Create `schema/build-prompt.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildSynthesisPrompt } from "./build-prompt.js";

test("includes provided articles and instructs synthesis from them only", () => {
  const prompt = buildSynthesisPrompt({
    topic: "Zoning change",
    articles: [
      { source: "AP", title: "Council approves zoning change", snippet: "5-2 vote", url: "https://example.com/ap" }
    ]
  });
  assert.match(prompt, /Zoning change/);
  assert.match(prompt, /AP/);
  assert.match(prompt, /Council approves zoning change/);
  assert.match(prompt, /https:\/\/example\.com\/ap/);
});

test("instructs web search when no articles are provided", () => {
  const prompt = buildSynthesisPrompt({ topic: "Zoning change", articles: [] });
  assert.match(prompt, /web search/i);
  assert.match(prompt, /Zoning change/);
});

test("always includes the required JSON shape and disagreement-preservation rule", () => {
  const prompt = buildSynthesisPrompt({ topic: "X", articles: [] });
  assert.match(prompt, /disagreementGroups/);
  assert.match(prompt, /narrative/);
  assert.match(prompt, /sourceList/);
  assert.match(prompt, /Do NOT blend disagreements/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test schema/build-prompt.test.js`
Expected: FAIL — `Cannot find module './build-prompt.js'`

- [ ] **Step 3: Write the implementation**

Create `schema/build-prompt.js`:

```js
export function buildSynthesisPrompt({ topic, articles }) {
  const hasArticles = Array.isArray(articles) && articles.length > 0;

  const sourceInstructions = hasArticles
    ? `Synthesize coverage of "${topic}" using only the following articles:\n\n` +
      articles
        .map((a, i) => `[${i + 1}] ${a.source}: "${a.title}"\n${a.snippet}\nURL: ${a.url}`)
        .join("\n\n")
    : `Use your web search tool to find current, credible news coverage of "${topic}" from at least 3 distinct outlets, then synthesize it.`;

  return `${sourceInstructions}

Write the synthesis as a single JSON object (and nothing else — no markdown fences, no commentary) with exactly this shape:

{
  "generatedAt": "<ISO-8601 timestamp for right now>",
  "query": "${topic}",
  "consensus": "<one neutral sentence stating what sources agree happened>",
  "narrative": [
    { "text": "<a sentence or clause of the story>", "sources": ["<outlet name>"], "stance": "corroborating" | "dissenting" }
  ],
  "disagreementGroups": [
    { "stance": "<short label for a framing/position>", "sources": ["<outlet name>"] }
  ],
  "sourceList": [ { "name": "<outlet name>", "url": "<article url>" } ]
}

Rules:
- Every outlet name used in "sources" (in narrative or disagreementGroups) must also appear in "sourceList".
- Do NOT blend disagreements between sources into a single flattened take. If outlets frame the story differently, represent that explicitly via "stance" in narrative entries and via "disagreementGroups". A story with no real disagreement can have an empty "disagreementGroups" array.
- "narrative" should read as a coherent short article when its "text" fields are concatenated with spaces.
- Output raw JSON only — no markdown code fences, no leading or trailing commentary.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test schema/build-prompt.test.js`
Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add schema/build-prompt.js schema/build-prompt.test.js
git commit -m "feat: add shared Claude synthesis prompt builder"
```

---

### Task 4: Fixture archive data for front-end development

**Files:**
- Create: `data/sample-beat/index.json`
- Create: `data/sample-beat/2026-07-24T12-00-00-000Z.json`
- Test: `data/sample-beat.test.js`

**Interfaces:**
- Produces: fixture data matching the `validateSynthesis` shape from Task 2, used by Tasks 6 and 7 to develop and manually test the front-end before the real pipeline (Tasks 8–13) exists.

- [ ] **Step 1: Write the failing test**

Create `data/sample-beat.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateSynthesis } from "../schema/validate-synthesis.js";

test("fixture archive entry passes validateSynthesis", async () => {
  const raw = await readFile(new URL("./sample-beat/2026-07-24T12-00-00-000Z.json", import.meta.url), "utf8");
  const { valid, errors } = validateSynthesis(JSON.parse(raw));
  assert.equal(valid, true, errors.join("; "));
});

test("fixture index.json points at an existing entry file", async () => {
  const raw = await readFile(new URL("./sample-beat/index.json", import.meta.url), "utf8");
  const index = JSON.parse(raw);
  assert.equal(index.latest, "2026-07-24T12-00-00-000Z.json");
  assert.ok(index.entries.includes(index.latest));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test data/sample-beat.test.js`
Expected: FAIL — `ENOENT` reading the missing fixture files

- [ ] **Step 3: Create the fixture files**

Create `data/sample-beat/2026-07-24T12-00-00-000Z.json`:

```json
{
  "generatedAt": "2026-07-24T12:00:00.000Z",
  "query": "Sample Beat (replace me)",
  "consensus": "This is a sample snapshot so you can see the layout before the real pipeline runs.",
  "narrative": [
    { "text": "This sentence is shown as agreed-upon coverage.", "sources": ["Reuters"], "stance": "corroborating" },
    { "text": "This sentence is shown as a dissenting framing.", "sources": ["Local Tribune"], "stance": "dissenting" }
  ],
  "disagreementGroups": [
    { "stance": "Framed as good news", "sources": ["Reuters"] },
    { "stance": "Framed critically", "sources": ["Local Tribune"] }
  ],
  "sourceList": [
    { "name": "Reuters", "url": "https://example.com/reuters-sample" },
    { "name": "Local Tribune", "url": "https://example.com/tribune-sample" }
  ]
}
```

Create `data/sample-beat/index.json`:

```json
{
  "latest": "2026-07-24T12-00-00-000Z.json",
  "entries": ["2026-07-24T12-00-00-000Z.json"]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test data/sample-beat.test.js`
Expected: PASS — 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add data/sample-beat/ data/sample-beat.test.js
git commit -m "test: add fixture archive data for front-end development"
```

---

### Task 5: Shared front-end article renderer

**Files:**
- Create: `js/render-article.js`
- Test: `js/render-article.test.js`

**Interfaces:**
- Consumes: a synthesis object matching the Task 2 shape.
- Produces: `renderArticle(data) -> string` (HTML fragment) and `escapeHtml(str) -> string`. Consumed by `js/front-page.js` (Task 6), `js/beat-page.js` (Task 7), and `js/search-page.js` (Task 15).
- Pure string templating — no DOM APIs — so it's testable under plain Node without jsdom, and usable unmodified in the browser via `<script type="module">`.

- [ ] **Step 1: Write the failing test**

Create `js/render-article.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { renderArticle, escapeHtml } from "./render-article.js";

const sample = {
  generatedAt: "2026-07-24T12:00:00.000Z",
  query: "Sample",
  consensus: "Sources agree the event happened.",
  narrative: [
    { text: "It happened.", sources: ["AP"], stance: "corroborating" },
    { text: "Some call it bad.", sources: ["Local Tribune"], stance: "dissenting" }
  ],
  disagreementGroups: [
    { stance: "Framed positively", sources: ["AP"] }
  ],
  sourceList: [
    { name: "AP", url: "https://example.com/ap" },
    { name: "Local Tribune", url: "https://example.com/tribune" }
  ]
};

test("escapeHtml neutralizes HTML special characters", () => {
  assert.equal(escapeHtml("<script>&\"'"), "&lt;script&gt;&amp;&quot;&#39;");
});

test("renderArticle includes narrative text and source chips", () => {
  const html = renderArticle(sample);
  assert.match(html, /It happened\./);
  assert.match(html, /chip-agree/);
  assert.match(html, /chip-dissent/);
  assert.match(html, />AP</);
});

test("renderArticle includes the consensus line and disagreement groups", () => {
  const html = renderArticle(sample);
  assert.match(html, /Sources agree the event happened\./);
  assert.match(html, /Framed positively/);
});

test("renderArticle shows a fallback message when there is no disagreement", () => {
  const html = renderArticle({ ...sample, disagreementGroups: [] });
  assert.match(html, /No notable disagreement/);
});

test("renderArticle escapes narrative text to prevent HTML injection", () => {
  const malicious = { ...sample, narrative: [{ text: "<img src=x>", sources: ["AP"], stance: "corroborating" }] };
  const html = renderArticle(malicious);
  assert.doesNotMatch(html, /<img/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/render-article.test.js`
Expected: FAIL — `Cannot find module './render-article.js'`

- [ ] **Step 3: Write the implementation**

Create `js/render-article.js`:

```js
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function chipClass(stance) {
  return stance === "dissenting" ? "chip chip-dissent" : "chip chip-agree";
}

function renderNarrative(narrative) {
  return narrative
    .map(entry => {
      const chips = entry.sources
        .map(s => `<span class="${chipClass(entry.stance)}">${escapeHtml(s)}</span>`)
        .join(" ");
      return `<p>${escapeHtml(entry.text)} ${chips}</p>`;
    })
    .join("\n");
}

function renderDisagreements(groups) {
  if (groups.length === 0) {
    return `<p class="muted">No notable disagreement between sources.</p>`;
  }
  return groups
    .map(
      group =>
        `<div class="disagreement-group"><h4>${escapeHtml(group.stance)}</h4><p>${group.sources
          .map(escapeHtml)
          .join(", ")}</p></div>`
    )
    .join("\n");
}

export function renderArticle(data) {
  return `
    <article>
      <div class="narrative">${renderNarrative(data.narrative)}</div>
      <hr>
      <section class="snapshot">
        <p class="label">Snapshot</p>
        <p class="consensus">${escapeHtml(data.consensus)}</p>
        <div class="disagreements">${renderDisagreements(data.disagreementGroups)}</div>
      </section>
    </article>
  `;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/render-article.test.js`
Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add js/render-article.js js/render-article.test.js
git commit -m "feat: add shared article renderer"
```

---

### Task 6: Front page (beats list)

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `js/front-page.js`

**Interfaces:**
- Consumes: `beats.json` (Task 1), `data/<slug>/index.json` + `data/<slug>/<entry>.json` (Task 4 fixture, later Task 12 real data), `escapeHtml` from `js/render-article.js` (Task 5).
- Produces: nothing consumed by later tasks (leaf page), but establishes `css/style.css` classes reused by Tasks 7 and 15: `.chip`, `.chip-agree`, `.chip-dissent`, `.muted`, `.disagreement-group`, `.label`, `.consensus`, `.snapshot`, `.nav`, `.beat-card`.

- [ ] **Step 1: Create `css/style.css`**

```css
:root {
  color-scheme: light dark;
  --agree: #2a8a4a;
  --dissent: #a83a2a;
  --border: #888;
}

body {
  font-family: system-ui, sans-serif;
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
  line-height: 1.6;
}

.nav {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  font-weight: bold;
}

.nav a {
  color: inherit;
}

.chip {
  display: inline-block;
  border-radius: 8px;
  padding: 1px 8px;
  font-size: 11px;
  color: #fff;
  margin-left: 2px;
}

.chip-agree {
  background: var(--agree);
}

.chip-dissent {
  background: var(--dissent);
}

.muted {
  opacity: 0.7;
  font-style: italic;
}

.label {
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.05em;
  opacity: 0.7;
  margin-bottom: 4px;
}

.snapshot {
  margin-top: 8px;
}

.consensus {
  font-weight: bold;
}

.disagreement-group {
  margin-bottom: 8px;
}

.beat-card {
  display: block;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  text-decoration: none;
  color: inherit;
}

.beat-card h3 {
  margin: 0 0 6px 0;
}

.timestamp {
  font-size: 12px;
  opacity: 0.6;
}

.history-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
  font-size: 12px;
}

.history-item {
  color: inherit;
  opacity: 0.6;
}

.history-item.active {
  opacity: 1;
  font-weight: bold;
}

.error {
  color: var(--dissent);
}
```

- [ ] **Step 2: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>News Synthesis</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <nav class="nav">
    <a href="index.html">Home</a>
    <a href="search.html">Search</a>
  </nav>
  <h1>Your Beats</h1>
  <div id="beats"></div>
  <script type="module" src="js/front-page.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `js/front-page.js`**

```js
import { escapeHtml } from "./render-article.js";

function renderBeatCard(beat, latest) {
  return `
    <a class="beat-card" href="beat.html?beat=${encodeURIComponent(beat.slug)}">
      <h3>${escapeHtml(beat.label)}</h3>
      <p>${escapeHtml(latest.consensus)}</p>
      <p class="timestamp">${new Date(latest.generatedAt).toLocaleString()}</p>
    </a>
  `;
}

async function loadBeats() {
  const beats = await (await fetch("beats.json")).json();
  const container = document.getElementById("beats");
  container.innerHTML = "";

  for (const beat of beats) {
    try {
      const index = await (await fetch(`data/${beat.slug}/index.json`)).json();
      const latest = await (await fetch(`data/${beat.slug}/${index.latest}`)).json();
      container.insertAdjacentHTML("beforeend", renderBeatCard(beat, latest));
    } catch (err) {
      console.warn(`No data yet for beat "${beat.slug}"`, err);
      container.insertAdjacentHTML(
        "beforeend",
        `<div class="beat-card muted">${escapeHtml(beat.label)} — no data yet</div>`
      );
    }
  }
}

loadBeats();
```

- [ ] **Step 4: Manually verify in a browser**

Run: `python3 -m http.server 8000` from the repo root
Open: `http://localhost:8000/index.html`
Expected: a "Sample Beat (replace me)" card is shown with the fixture consensus text and a timestamp. Clicking it navigates to `beat.html?beat=sample-beat` (a 404/blank page is expected until Task 7 — that's fine for this step).

- [ ] **Step 5: Commit**

```bash
git add index.html css/style.css js/front-page.js
git commit -m "feat: add front page listing saved beats"
```

---

### Task 7: Beat article page

**Files:**
- Create: `beat.html`
- Create: `js/beat-page.js`

**Interfaces:**
- Consumes: `beats.json`, `data/<slug>/index.json`, `data/<slug>/<entry>.json`, `renderArticle` from `js/render-article.js` (Task 5).

- [ ] **Step 1: Create `beat.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Beat</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <nav class="nav">
    <a href="index.html">Home</a>
    <a href="search.html">Search</a>
  </nav>
  <h1 id="beat-title">Loading…</h1>
  <div class="history-strip" id="history"></div>
  <div id="content"></div>
  <script type="module" src="js/beat-page.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `js/beat-page.js`**

```js
import { renderArticle } from "./render-article.js";

function renderHistoryStrip(index, slug, activeEntry) {
  const strip = document.getElementById("history");
  strip.innerHTML = index.entries
    .slice()
    .reverse()
    .map(entry => {
      const label = entry.replace(/\.json$/, "");
      const activeClass = entry === activeEntry ? "history-item active" : "history-item";
      return `<a class="${activeClass}" href="beat.html?beat=${encodeURIComponent(slug)}&entry=${encodeURIComponent(entry)}">${label}</a>`;
    })
    .join(" ");
}

async function loadBeatPage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("beat");
  const beats = await (await fetch("beats.json")).json();
  const beat = beats.find(b => b.slug === slug);

  if (!beat) {
    document.getElementById("beat-title").textContent = "Unknown beat";
    document.getElementById("content").innerHTML = `<p class="error">No beat found for "${slug}".</p>`;
    return;
  }

  document.getElementById("beat-title").textContent = beat.label;

  try {
    const index = await (await fetch(`data/${beat.slug}/index.json`)).json();
    const entryParam = params.get("entry") || index.latest;
    const data = await (await fetch(`data/${beat.slug}/${entryParam}`)).json();
    document.getElementById("content").innerHTML = renderArticle(data);
    renderHistoryStrip(index, slug, entryParam);
  } catch (err) {
    document.getElementById("content").innerHTML = `<p class="error">No data yet for this beat.</p>`;
  }
}

loadBeatPage();
```

- [ ] **Step 3: Manually verify in a browser**

With the local server from Task 6 still running, open: `http://localhost:8000/beat.html?beat=sample-beat`
Expected: title "Sample Beat (replace me)", the two fixture narrative sentences with green/red chips, a "Snapshot" section with the consensus line and one disagreement group, and a history strip with one entry.

- [ ] **Step 4: Commit**

```bash
git add beat.html js/beat-page.js
git commit -m "feat: add beat article page with history strip"
```

---

### Task 8: RSS feed fetching and parsing

**Files:**
- Create: `scripts/lib/rss.js`
- Test: `scripts/lib/rss.test.js`

**Interfaces:**
- Produces: `parseFeedXml(xmlText: string) -> Array<{title, link, snippet, pubDate}>` and `fetchFeed(url: string, fetchImpl?) -> Promise<Array<...>>`. Consumed by `scripts/refresh-beats.js` (Task 12).

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/rss.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseFeedXml, fetchFeed } from "./rss.js";

const sampleRss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Sample Feed</title>
    <item>
      <title>Council approves zoning change</title>
      <link>https://example.com/story1</link>
      <description>&lt;p&gt;The council voted 5-2.&lt;/p&gt;</description>
      <pubDate>Fri, 24 Jul 2026 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second story</title>
      <link>https://example.com/story2</link>
      <description>Plain text description</description>
      <pubDate>Fri, 24 Jul 2026 13:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

test("parseFeedXml extracts items with stripped HTML descriptions", () => {
  const items = parseFeedXml(sampleRss);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Council approves zoning change");
  assert.equal(items[0].link, "https://example.com/story1");
  assert.equal(items[0].snippet, "The council voted 5-2.");
  assert.equal(items[1].snippet, "Plain text description");
});

test("parseFeedXml returns an empty array for a feed with no items", () => {
  const empty = `<?xml version="1.0"?><rss version="2.0"><channel><title>Empty</title></channel></rss>`;
  assert.deepEqual(parseFeedXml(empty), []);
});

test("parseFeedXml returns an empty array for non-RSS XML", () => {
  assert.deepEqual(parseFeedXml(`<?xml version="1.0"?><notrss></notrss>`), []);
});

test("fetchFeed throws on a non-OK response", async () => {
  const fakeFetch = async () => ({ ok: false, status: 404, text: async () => "" });
  await assert.rejects(() => fetchFeed("https://example.com/missing.xml", fakeFetch), /404/);
});

test("fetchFeed returns parsed items on success", async () => {
  const fakeFetch = async () => ({ ok: true, status: 200, text: async () => sampleRss });
  const items = await fetchFeed("https://example.com/feed.xml", fakeFetch);
  assert.equal(items.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/rss.test.js`
Expected: FAIL — `Cannot find module './rss.js'`

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/rss.js`:

```js
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false });

function stripHtml(html) {
  return String(html).replace(/<[^>]*>/g, "").trim();
}

export function parseFeedXml(xmlText) {
  const doc = parser.parse(xmlText);
  const channel = doc.rss && doc.rss.channel;
  if (!channel) return [];

  const rawItems = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];

  return rawItems.map(item => ({
    title: typeof item.title === "string" ? item.title : "",
    link: typeof item.link === "string" ? item.link : "",
    snippet: typeof item.description === "string" ? stripHtml(item.description) : "",
    pubDate: item.pubDate || null
  }));
}

export async function fetchFeed(url, fetchImpl = fetch) {
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Feed fetch failed (${res.status}): ${url}`);
  }
  const xmlText = await res.text();
  return parseFeedXml(xmlText);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/rss.test.js`
Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rss.js scripts/lib/rss.test.js
git commit -m "feat: add RSS feed fetching and parsing"
```

---

### Task 9: Beat matching

**Files:**
- Create: `scripts/lib/beat-matching.js`
- Test: `scripts/lib/beat-matching.test.js`

**Interfaces:**
- Produces: `matchesBeat(item: {title, snippet}, beat: {searchTerms}) -> boolean`. Consumed by `scripts/refresh-beats.js` (Task 12).

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/beat-matching.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { matchesBeat } from "./beat-matching.js";

test("matches when a search term appears in the title", () => {
  const item = { title: "City council approves zoning change", snippet: "" };
  assert.equal(matchesBeat(item, { searchTerms: "zoning change" }), true);
});

test("matches when a search term appears in the snippet", () => {
  const item = { title: "Local news", snippet: "The zoning change passed today" };
  assert.equal(matchesBeat(item, { searchTerms: "zoning" }), true);
});

test("matching is case-insensitive", () => {
  const item = { title: "ZONING update", snippet: "" };
  assert.equal(matchesBeat(item, { searchTerms: "zoning" }), true);
});

test("does not match when no search term appears", () => {
  const item = { title: "Weather forecast", snippet: "Sunny skies ahead" };
  assert.equal(matchesBeat(item, { searchTerms: "zoning change" }), false);
});

test("matches on any one of multiple space-separated terms", () => {
  const item = { title: "Housing costs rise", snippet: "" };
  assert.equal(matchesBeat(item, { searchTerms: "zoning housing" }), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/beat-matching.test.js`
Expected: FAIL — `Cannot find module './beat-matching.js'`

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/beat-matching.js`:

```js
export function matchesBeat(item, beat) {
  const haystack = `${item.title} ${item.snippet}`.toLowerCase();
  return beat.searchTerms
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .some(term => haystack.includes(term));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/beat-matching.test.js`
Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/beat-matching.js scripts/lib/beat-matching.test.js
git commit -m "feat: add beat matching for filtering RSS items"
```

---

### Task 10: Archive index updating

**Files:**
- Create: `scripts/lib/archive-index.js`
- Test: `scripts/lib/archive-index.test.js`

**Interfaces:**
- Produces: `updateIndex(existingIndex: {latest, entries} | null, filename: string) -> {latest, entries}`. Consumed by `scripts/refresh-beats.js` (Task 12).

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/archive-index.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { updateIndex } from "./archive-index.js";

test("creates a new index when none existed before", () => {
  const result = updateIndex(null, "2026-07-24T12-00-00-000Z.json");
  assert.deepEqual(result, {
    latest: "2026-07-24T12-00-00-000Z.json",
    entries: ["2026-07-24T12-00-00-000Z.json"]
  });
});

test("appends to an existing index and updates latest", () => {
  const existing = { latest: "2026-07-24T12-00-00-000Z.json", entries: ["2026-07-24T12-00-00-000Z.json"] };
  const result = updateIndex(existing, "2026-07-24T18-00-00-000Z.json");
  assert.deepEqual(result, {
    latest: "2026-07-24T18-00-00-000Z.json",
    entries: ["2026-07-24T12-00-00-000Z.json", "2026-07-24T18-00-00-000Z.json"]
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/archive-index.test.js`
Expected: FAIL — `Cannot find module './archive-index.js'`

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/archive-index.js`:

```js
export function updateIndex(existingIndex, filename) {
  const entries = [...(existingIndex?.entries || []), filename];
  return { latest: filename, entries };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/archive-index.test.js`
Expected: PASS — 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/archive-index.js scripts/lib/archive-index.test.js
git commit -m "feat: add archive index updating logic"
```

---

### Task 11: Synthesize library (Anthropic API call + validation)

**Files:**
- Create: `scripts/lib/synthesize.js`
- Test: `scripts/lib/synthesize.test.js`

**Interfaces:**
- Consumes: `buildSynthesisPrompt` from `schema/build-prompt.js` (Task 3), `validateSynthesis` from `schema/validate-synthesis.js` (Task 2).
- Produces: `synthesizeBeat({ topic: string, articles: Array }, client) -> Promise<object>` where `client` is any object with a `messages.create(...)` method matching the `@anthropic-ai/sdk` shape (allows tests to inject a fake client). Consumed by `scripts/refresh-beats.js` (Task 12).

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/synthesize.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { synthesizeBeat } from "./synthesize.js";

const validResult = {
  generatedAt: "2026-07-24T12:00:00.000Z",
  query: "Zoning change",
  consensus: "The council approved the change.",
  narrative: [{ text: "It passed.", sources: ["AP"], stance: "corroborating" }],
  disagreementGroups: [],
  sourceList: [{ name: "AP", url: "https://example.com/ap" }]
};

function fakeClient(responseText) {
  return {
    messages: {
      create: async () => ({ content: [{ type: "text", text: responseText }] })
    }
  };
}

test("returns the parsed, validated result on success", async () => {
  const client = fakeClient(JSON.stringify(validResult));
  const result = await synthesizeBeat({ topic: "Zoning change", articles: [] }, client);
  assert.deepEqual(result, validResult);
});

test("throws when Claude does not return valid JSON", async () => {
  const client = fakeClient("not json");
  await assert.rejects(
    () => synthesizeBeat({ topic: "X", articles: [] }, client),
    /did not return valid JSON/
  );
});

test("throws when Claude's JSON fails schema validation", async () => {
  const invalid = { ...validResult, narrative: [] };
  const client = fakeClient(JSON.stringify(invalid));
  await assert.rejects(
    () => synthesizeBeat({ topic: "X", articles: [] }, client),
    /failed validation/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/synthesize.test.js`
Expected: FAIL — `Cannot find module './synthesize.js'`

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/synthesize.js`:

```js
import { buildSynthesisPrompt } from "../../schema/build-prompt.js";
import { validateSynthesis } from "../../schema/validate-synthesis.js";

export async function synthesizeBeat({ topic, articles }, client) {
  const prompt = buildSynthesisPrompt({ topic, articles });

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }]
  });

  const text = response.content
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Claude did not return valid JSON: ${err.message}`);
  }

  const { valid, errors } = validateSynthesis(parsed);
  if (!valid) {
    throw new Error(`Synthesis output failed validation:\n${errors.join("\n")}`);
  }

  return parsed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/synthesize.test.js`
Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/synthesize.js scripts/lib/synthesize.test.js
git commit -m "feat: add synthesize library wrapping Anthropic API call"
```

---

### Task 12: Refresh orchestrator + dry-run script

**Files:**
- Create: `scripts/refresh-beats.js`
- Create: `scripts/dry-run.js`

**Interfaces:**
- Consumes: `fetchFeed` (Task 8), `matchesBeat` (Task 9), `updateIndex` (Task 10), `synthesizeBeat` (Task 11).
- Produces: `refreshBeat({ beat, sources, client }) -> Promise<{ result: object, articleCount: number }>`, exported for `scripts/dry-run.js` and for the `main()` entrypoint in the same file. Consumed by the GitHub Actions workflow (Task 13) via `node scripts/refresh-beats.js`.

This is the one file in the plan without its own automated test — it's I/O-heavy glue code (file reads/writes, real network calls) whose pure logic already lives in the tested libraries above. It's validated manually via the dry-run script, per the spec's testing section.

- [ ] **Step 1: Create `scripts/refresh-beats.js`**

```js
import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { fetchFeed } from "./lib/rss.js";
import { matchesBeat } from "./lib/beat-matching.js";
import { updateIndex } from "./lib/archive-index.js";
import { synthesizeBeat } from "./lib/synthesize.js";

const ROOT = path.resolve(import.meta.dirname, "..");

async function loadJson(relPath) {
  const raw = await fs.readFile(path.join(ROOT, relPath), "utf8");
  return JSON.parse(raw);
}

function sourceNameForUrl(url, sources) {
  const match = sources.find(s => s.feedUrl === url);
  return match ? match.name : "Google News";
}

function googleNewsUrl(searchTerms) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerms)}&hl=en-US&gl=US&ceid=US:en`;
}

export async function collectArticles(beat, sources) {
  const feedUrls = [googleNewsUrl(beat.searchTerms), ...sources.map(s => s.feedUrl)];
  const articles = [];

  for (const url of feedUrls) {
    try {
      const items = await fetchFeed(url);
      for (const item of items) {
        if (matchesBeat(item, beat)) {
          articles.push({
            source: sourceNameForUrl(url, sources),
            title: item.title,
            snippet: item.snippet,
            url: item.link
          });
        }
      }
    } catch (err) {
      console.warn(`Feed failed, skipping: ${url}\n${err.message}`);
    }
  }

  return articles;
}

export async function refreshBeat({ beat, sources, client }) {
  const articles = await collectArticles(beat, sources);
  if (articles.length === 0) {
    return { result: null, articleCount: 0 };
  }
  const result = await synthesizeBeat({ topic: beat.label, articles }, client);
  return { result, articleCount: articles.length };
}

async function writeArchiveEntry(slug, result) {
  const dir = path.join(ROOT, "data", slug);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${result.generatedAt.replace(/[:.]/g, "-")}.json`;
  await fs.writeFile(path.join(dir, filename), JSON.stringify(result, null, 2));

  const indexPath = path.join(dir, "index.json");
  let existingIndex = null;
  try {
    existingIndex = JSON.parse(await fs.readFile(indexPath, "utf8"));
  } catch {
    // no existing index yet — updateIndex handles null
  }
  await fs.writeFile(indexPath, JSON.stringify(updateIndex(existingIndex, filename), null, 2));
}

async function main() {
  const beats = await loadJson("beats.json");
  const sources = await loadJson("sources.json");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  for (const beat of beats) {
    const { result, articleCount } = await refreshBeat({ beat, sources, client });
    if (!result) {
      console.warn(`Skipping beat "${beat.slug}": no articles found from any source`);
      continue;
    }
    await writeArchiveEntry(beat.slug, result);
    console.log(`Refreshed "${beat.slug}" from ${articleCount} articles`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 2: Create `scripts/dry-run.js`**

```js
import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { refreshBeat } from "./refresh-beats.js";

const ROOT = path.resolve(import.meta.dirname, "..");

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: node scripts/dry-run.js <beat-slug>");
    process.exit(1);
  }

  const beats = JSON.parse(await fs.readFile(path.join(ROOT, "beats.json"), "utf8"));
  const sources = JSON.parse(await fs.readFile(path.join(ROOT, "sources.json"), "utf8"));
  const beat = beats.find(b => b.slug === slug);

  if (!beat) {
    console.error(`No beat found with slug "${slug}". Available: ${beats.map(b => b.slug).join(", ")}`);
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { result, articleCount } = await refreshBeat({ beat, sources, client });

  if (!result) {
    console.log(`No articles found for "${slug}" — nothing to synthesize.`);
    return;
  }

  console.log(`Collected ${articleCount} articles for "${beat.label}"\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Manually verify with a real API key (you run this — requires your own `ANTHROPIC_API_KEY`)**

Run: `ANTHROPIC_API_KEY=sk-ant-... node scripts/dry-run.js sample-beat`
Expected: prints `Collected N articles for "Sample Beat (replace me)"` followed by a JSON object matching the Task 2 shape. Nothing is written to disk — this is a dry run. If `N` is 0, the search terms in `beats.json` don't match anything currently in the configured feeds; try broader search terms.

- [ ] **Step 4: Commit**

```bash
git add scripts/refresh-beats.js scripts/dry-run.js
git commit -m "feat: add refresh orchestrator and dry-run script"
```

---

### Task 13: GitHub Actions scheduled workflow

**Files:**
- Create: `.github/workflows/refresh-beats.yml`

**Interfaces:**
- Consumes: `scripts/refresh-beats.js` (Task 12) via `node scripts/refresh-beats.js`; the `ANTHROPIC_API_KEY` repo secret (set manually below).

- [ ] **Step 1: Create `.github/workflows/refresh-beats.yml`**

```yaml
name: Refresh Beats

on:
  schedule:
    - cron: "0 */6 * * *"
  workflow_dispatch: {}

permissions:
  contents: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - run: npm ci

      - run: node scripts/refresh-beats.js
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/
          git diff --cached --quiet || git commit -m "chore: refresh beat synthesis $(date -u +%Y-%m-%dT%H:%M:%SZ)"
          git push
```

- [ ] **Step 2: Set the Anthropic API key as a repo secret (you run this yourself — do not paste the key into chat)**

Run in your terminal (this prompts you to paste the key interactively, hidden from the shell history):

```bash
gh secret set ANTHROPIC_API_KEY --repo PapaPablano/News
```

- [ ] **Step 3: Commit the workflow file**

```bash
git add .github/workflows/refresh-beats.yml
git commit -m "feat: add scheduled GitHub Actions workflow to refresh beats"
git push
```

- [ ] **Step 4: Manually trigger and verify**

Run: `gh workflow run refresh-beats.yml --repo PapaPablano/News`
Then: `gh run watch --repo PapaPablano/News` (or check the Actions tab in the browser)
Expected: the run succeeds, and a new commit appears on `main` (authored by `github-actions[bot]`) adding a new dated file under `data/sample-beat/` and updating its `index.json`. If it fails on the API call, check that the secret was set correctly with `gh secret list --repo PapaPablano/News`.

---

### Task 14: Cloudflare Worker (live search proxy)

**Files:**
- Create: `worker/package.json`
- Create: `worker/wrangler.toml`
- Create: `worker/src/handler.js`
- Create: `worker/src/index.js`
- Test: `worker/src/handler.test.js`

**Interfaces:**
- Consumes: `buildSynthesisPrompt` (Task 3), `validateSynthesis` (Task 2), via relative imports (`../../schema/...`).
- Produces: `handleSearchRequest({ query, client, model }) -> Promise<{status, body}>`, wrapped by the Workers `fetch` handler in `index.js`. Consumed by `js/search-page.js` (Task 15) as an HTTP endpoint.

- [ ] **Step 1: Create `worker/package.json`**

```json
{
  "name": "news-synthesis-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "node --test src/*.test.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.0"
  },
  "devDependencies": {
    "wrangler": "^3.90.0"
  }
}
```

- [ ] **Step 2: Create `worker/wrangler.toml`**

```toml
name = "news-synthesis-worker"
main = "src/index.js"
compatibility_date = "2026-07-24"

[vars]
ANTHROPIC_MODEL = "claude-sonnet-5"
```

- [ ] **Step 3: Write the failing test**

Create `worker/src/handler.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { handleSearchRequest } from "./handler.js";

const validResult = {
  generatedAt: "2026-07-24T12:00:00.000Z",
  query: "Zoning change",
  consensus: "The council approved the change.",
  narrative: [{ text: "It passed.", sources: ["AP"], stance: "corroborating" }],
  disagreementGroups: [],
  sourceList: [{ name: "AP", url: "https://example.com/ap" }]
};

function fakeClient(responseText) {
  return {
    messages: {
      create: async () => ({ content: [{ type: "text", text: responseText }] })
    }
  };
}

test("returns 400 when query is empty", async () => {
  const { status, body } = await handleSearchRequest({ query: "", client: fakeClient(""), model: "m" });
  assert.equal(status, 400);
  assert.match(body.error, /Missing/);
});

test("returns 200 with the validated result on success", async () => {
  const { status, body } = await handleSearchRequest({
    query: "Zoning change",
    client: fakeClient(JSON.stringify(validResult)),
    model: "m"
  });
  assert.equal(status, 200);
  assert.deepEqual(body, validResult);
});

test("returns 502 when Claude's response is not valid JSON", async () => {
  const { status, body } = await handleSearchRequest({
    query: "Zoning change",
    client: fakeClient("not json"),
    model: "m"
  });
  assert.equal(status, 502);
  assert.match(body.error, /did not return valid JSON/);
});

test("returns 502 when the Anthropic call itself throws", async () => {
  const throwingClient = { messages: { create: async () => { throw new Error("rate limited"); } } };
  const { status, body } = await handleSearchRequest({ query: "X", client: throwingClient, model: "m" });
  assert.equal(status, 502);
  assert.match(body.error, /Claude API error/);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `node --test worker/src/handler.test.js`
Expected: FAIL — `Cannot find module './handler.js'`

- [ ] **Step 5: Write `worker/src/handler.js`**

```js
import { buildSynthesisPrompt } from "../../schema/build-prompt.js";
import { validateSynthesis } from "../../schema/validate-synthesis.js";

export async function handleSearchRequest({ query, client, model }) {
  if (!query) {
    return { status: 400, body: { error: "Missing 'query' field" } };
  }

  const prompt = buildSynthesisPrompt({ topic: query, articles: [] });

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }]
    });
  } catch (err) {
    return { status: 502, body: { error: `Claude API error: ${err.message}` } };
  }

  const text = response.content
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { status: 502, body: { error: `Claude did not return valid JSON: ${err.message}` } };
  }

  const { valid, errors } = validateSynthesis(parsed);
  if (!valid) {
    return { status: 502, body: { error: `Synthesis output failed validation: ${errors.join("; ")}` } };
  }

  return { status: 200, body: parsed };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test worker/src/handler.test.js`
Expected: PASS — 4 tests passing

- [ ] **Step 7: Write `worker/src/index.js` (the Workers entrypoint, not unit tested — thin HTTP/CORS wrapper around `handleSearchRequest`)**

```js
import Anthropic from "@anthropic-ai/sdk";
import { handleSearchRequest } from "./handler.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed" });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const { status, body: resultBody } = await handleSearchRequest({
      query: typeof body.query === "string" ? body.query.trim() : "",
      client,
      model: env.ANTHROPIC_MODEL || "claude-sonnet-5"
    });

    return jsonResponse(status, resultBody);
  }
};
```

The browser will send a CORS preflight `OPTIONS` request before the real `POST` (since `Content-Type: application/json` isn't a CORS-simple content type) — the `OPTIONS` branch above is required for the search page (Task 15) to work at all, not optional polish.

- [ ] **Step 8: Install worker dependencies**

Run: `cd worker && npm install && cd ..`
Expected: creates `worker/node_modules/` and `worker/package-lock.json`.

- [ ] **Step 9: Commit**

```bash
git add worker/package.json worker/package-lock.json worker/wrangler.toml worker/src/handler.js worker/src/handler.test.js worker/src/index.js
git commit -m "feat: add Cloudflare Worker live search proxy"
```

---

### Task 15: Search page

**Files:**
- Create: `search.html`
- Create: `js/search-page.js`

**Interfaces:**
- Consumes: `renderArticle` from `js/render-article.js` (Task 5); posts to the Cloudflare Worker deployed in Task 16.

- [ ] **Step 1: Create `search.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Search</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <nav class="nav">
    <a href="index.html">Home</a>
    <a href="search.html">Search</a>
  </nav>
  <h1>Search</h1>
  <form id="search-form">
    <input id="query" type="text" placeholder="What do you want to know about?" style="width: 70%; padding: 6px;">
    <button type="submit">Search</button>
  </form>
  <div id="content"></div>
  <script type="module" src="js/search-page.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `js/search-page.js`**

```js
import { renderArticle } from "./render-article.js";

// Updated in Task 16 once the Worker is deployed and its real URL is known.
const WORKER_URL = "https://news-synthesis-worker.YOUR-SUBDOMAIN.workers.dev";

async function handleSearch(event) {
  event.preventDefault();
  const query = document.getElementById("query").value.trim();
  if (!query) return;

  const content = document.getElementById("content");
  content.innerHTML = "<p>Searching…</p>";

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Search failed (${res.status})`);
    }
    content.innerHTML = renderArticle(data);
  } catch (err) {
    content.innerHTML = `<p class="error">Search failed, try again. (${err.message})</p>`;
  }
}

document.getElementById("search-form").addEventListener("submit", handleSearch);
```

- [ ] **Step 3: Manually verify against a local Worker dev server**

In one terminal: `cd worker && ANTHROPIC_API_KEY=sk-ant-... npx wrangler dev` (starts the Worker locally, prints a `http://localhost:8787` URL)
Temporarily edit `WORKER_URL` in `js/search-page.js` to that local URL.
In another terminal: `python3 -m http.server 8000` from the repo root, open `http://localhost:8000/search.html`, submit a real query.
Expected: "Searching…" then a rendered article with narrative, chips, and snapshot panel — sourced from Claude's live web search. Revert `WORKER_URL` back to the placeholder afterward (Task 16 sets the real deployed value).

- [ ] **Step 4: Commit**

```bash
git add search.html js/search-page.js
git commit -m "feat: add live search page"
```

---

### Task 16: Deploy the Worker and wire up production

**Files:**
- Modify: `js/search-page.js` (update `WORKER_URL`)

This task is manual deployment and configuration — it requires your own Cloudflare account credentials, which the agent cannot supply. Run each step yourself.

- [ ] **Step 1: Authenticate with Cloudflare**

```bash
cd worker
npx wrangler login
```

This opens a browser to authorize Wrangler against your Cloudflare account.

- [ ] **Step 2: Set the Worker's Anthropic API key secret**

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Paste your key when prompted (hidden input, not shown in shell history).

- [ ] **Step 3: Deploy the Worker**

```bash
npx wrangler deploy
```

Expected output includes a line like `Published news-synthesis-worker (... ) https://news-synthesis-worker.<your-subdomain>.workers.dev`. Copy that URL.

- [ ] **Step 4: Update the front-end with the real Worker URL**

Edit `js/search-page.js`, replacing:

```js
const WORKER_URL = "https://news-synthesis-worker.YOUR-SUBDOMAIN.workers.dev";
```

with your actual deployed URL from Step 3.

```bash
cd ..
git add js/search-page.js
git commit -m "chore: point search page at deployed Cloudflare Worker"
git push
```

- [ ] **Step 5: Confirm GitHub Pages is serving from the repo root**

In the repo's GitHub Settings → Pages, confirm the source is "Deploy from a branch," branch `main`, folder `/ (root)`. This matches where `index.html`, `beat.html`, and `search.html` live.

- [ ] **Step 6: End-to-end verification**

1. Open your GitHub Pages URL → confirm the front page loads and shows the sample beat card.
2. Click into the sample beat → confirm the article page renders with chips and snapshot.
3. Go to Search → submit a real query → confirm a live-synthesized result renders (this exercises the deployed Worker, not local dev).
4. Run `gh workflow run refresh-beats.yml --repo PapaPablano/News` and confirm (via `gh run watch` or the Actions tab) that it completes and pushes a new commit with fresh data under `data/`.

Once all four checks pass, v1 is complete and live.
