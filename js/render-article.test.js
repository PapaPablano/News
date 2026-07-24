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
