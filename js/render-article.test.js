import test from "node:test";
import assert from "node:assert/strict";
import { renderArticle, escapeHtml, EXPECTED_SCHEMA_VERSION } from "./render-article.js";

const sample = {
  schemaVersion: EXPECTED_SCHEMA_VERSION,
  generatedAt: "2026-07-24T12:00:00.000Z",
  query: "Sample",
  headline: "Something significant happened",
  consensus: "Sources agree the event happened.",
  sections: [
    {
      subheading: "What happened",
      framingLabel: null,
      sentences: [
        { text: "It happened.", sources: ["AP"], disputed: false },
        { text: "Some call it bad.", sources: ["Local Tribune"], disputed: true }
      ]
    },
    {
      subheading: "Reaction",
      framingLabel: "One perspective:",
      sentences: [
        { text: "Officials praised the response.", sources: ["AP"], disputed: false }
      ]
    }
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

test("renderArticle happy path: headline, R8 indicator, sections, and snapshot all render", () => {
  const html = renderArticle(sample);

  // Headline
  assert.match(html, /<h1>Something significant happened<\/h1>/);

  // R8 disagreement indicator present (disagreementGroups is non-empty)
  assert.match(html, /class="disagreement-indicator disagreement-indicator--link"/);
  assert.match(html, /href="#snapshot"/);

  // Both sections with subheadings
  assert.match(html, /<h3>What happened<\/h3>/);
  assert.match(html, /<h3>Reaction<\/h3>/);

  // Disputed sentence gets wrapped
  assert.match(html, /<span class="disputed-sentence">Some call it bad\.<\/span>/);
  // Non-disputed sentence renders as plain text (not wrapped)
  assert.match(html, /It happened\./);

  // Per-section source lists (deduplicated outlet names)
  assert.match(html, /class="section-sources"/);
  assert.match(html, /Sources: AP, Local Tribune/);
  assert.match(html, /Sources: AP</);

  // framingLabel renders as bold prefix
  assert.match(html, /<strong class="framing-label">One perspective:<\/strong>/);

  // Snapshot panel
  assert.match(html, /id="snapshot"/);
  assert.match(html, /Sources agree the event happened\./);
  assert.match(html, /Framed positively/);
});

test("renderArticle with empty disagreementGroups: no R8 indicator, softened snapshot copy, anchor still present", () => {
  const html = renderArticle({ ...sample, disagreementGroups: [] });

  assert.doesNotMatch(html, /disagreement-indicator/);
  assert.match(html, /No disagreement detected among sources reviewed\./);
  assert.match(html, /id="snapshot"/);
});

test("renderArticle renders correctly with a single section (floor of 1)", () => {
  const single = {
    ...sample,
    sections: [
      {
        subheading: "Only section",
        framingLabel: null,
        sentences: [{ text: "The only fact.", sources: ["AP"], disputed: false }]
      }
    ]
  };
  const html = renderArticle(single);
  assert.match(html, /<h3>Only section<\/h3>/);
  assert.match(html, /The only fact\./);
  assert.match(html, /Sources: AP</);
});

test("renderArticle renders paired framingLabels across multiple sections without dropping either side", () => {
  const paired = {
    ...sample,
    sections: [
      {
        subheading: "Side A",
        framingLabel: "One perspective:",
        sentences: [{ text: "Side A says X.", sources: ["AP"], disputed: false }]
      },
      {
        subheading: "Side B",
        framingLabel: "Another angle:",
        sentences: [{ text: "Side B says Y.", sources: ["Local Tribune"], disputed: false }]
      }
    ]
  };
  const html = renderArticle(paired);
  assert.match(html, /<strong class="framing-label">One perspective:<\/strong>/);
  assert.match(html, /<strong class="framing-label">Another angle:<\/strong>/);
});

test("renderArticle renders framingLabel and a disputed sentence together in the same section without either suppressing the other", () => {
  const both = {
    ...sample,
    sections: [
      {
        subheading: "Contested",
        framingLabel: "One perspective:",
        sentences: [{ text: "This claim is contested.", sources: ["AP"], disputed: true }]
      }
    ]
  };
  const html = renderArticle(both);
  assert.match(html, /<strong class="framing-label">One perspective:<\/strong>/);
  assert.match(html, /<span class="disputed-sentence">This claim is contested\.<\/span>/);
});

test("renderArticle shows the permanent older-format fallback when schemaVersion is entirely absent", () => {
  const noVersion = { ...sample };
  delete noVersion.schemaVersion;

  const html = renderArticle(noVersion);
  assert.match(html, /older article that predates the current site design/i);
  assert.doesNotMatch(html, /refresh/i);
});

test("renderArticle does not attempt to read sections/headline when schemaVersion is absent", () => {
  // Minimal object with no sections/headline at all -- must not throw.
  assert.doesNotThrow(() => renderArticle({}));
  const html = renderArticle({});
  assert.match(html, /older article that predates the current site design/i);
});

test("renderArticle shows a transient refresh fallback when schemaVersion is present but mismatched", () => {
  const htmlV1 = renderArticle({ schemaVersion: 1 });
  assert.match(htmlV1, /refresh/i);

  const htmlV99 = renderArticle({ ...sample, schemaVersion: 99 });
  assert.match(htmlV99, /refresh/i);
});

test("the absent-schemaVersion and mismatched-schemaVersion fallback messages are distinguishably different", () => {
  const absentHtml = renderArticle({});
  const mismatchedHtml = renderArticle({ schemaVersion: 1 });
  assert.notEqual(absentHtml, mismatchedHtml);
  assert.doesNotMatch(absentHtml, /refresh/i);
  assert.match(mismatchedHtml, /refresh/i);
});

test("renderArticle escapes malicious HTML in headline, subheading, framingLabel, and sentence text", () => {
  const malicious = {
    ...sample,
    headline: "<script>alert(1)</script>",
    sections: [
      {
        subheading: "<img src=x onerror=alert(1)>",
        framingLabel: "<script>evil()</script>",
        sentences: [
          { text: "<img src=x>", sources: ["AP"], disputed: false },
          { text: "<script>bad()</script>", sources: ["AP"], disputed: true }
        ]
      }
    ]
  };
  const html = renderArticle(malicious);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
});
