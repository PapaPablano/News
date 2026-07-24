import test from "node:test";
import assert from "node:assert/strict";
import { buildSynthesisPrompt } from "./build-prompt.js";
import { SCHEMA_VERSION } from "./validate-synthesis.js";

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

test("articles-provided branch includes the full new shape spec including schemaVersion", () => {
  const prompt = buildSynthesisPrompt({
    topic: "Zoning change",
    articles: [
      { source: "AP", title: "Council approves zoning change", snippet: "5-2 vote", url: "https://example.com/ap" }
    ]
  });
  assert.match(prompt, new RegExp(`"schemaVersion":\\s*${SCHEMA_VERSION}`));
  assert.match(prompt, /"headline"/);
  assert.match(prompt, /"sections"/);
  assert.match(prompt, /"subheading"/);
  assert.match(prompt, /"framingLabel"/);
  assert.match(prompt, /"disputed"/);
});

test("instructs web search when no articles are provided", () => {
  const prompt = buildSynthesisPrompt({ topic: "Zoning change", articles: [] });
  assert.match(prompt, /web search/i);
  assert.match(prompt, /Zoning change/);
});

test("web-search branch also includes the full new shape spec including schemaVersion", () => {
  const prompt = buildSynthesisPrompt({ topic: "Zoning change", articles: [] });
  assert.match(prompt, new RegExp(`"schemaVersion":\\s*${SCHEMA_VERSION}`));
  assert.match(prompt, /"headline"/);
  assert.match(prompt, /"sections"/);
  assert.match(prompt, /"subheading"/);
  assert.match(prompt, /"framingLabel"/);
  assert.match(prompt, /"disputed"/);
});

test("states the 2-4 section target with an explicit floor-of-1 / don't-pad-thin-stories rule", () => {
  const prompt = buildSynthesisPrompt({ topic: "X", articles: [] });
  assert.match(prompt, /2-4/);
  assert.match(prompt, /floor of 1/i);
  assert.match(prompt, /pad/i);
});

test("always includes the required JSON shape and disagreement-preservation rule", () => {
  const prompt = buildSynthesisPrompt({ topic: "X", articles: [] });
  assert.match(prompt, /disagreementGroups/);
  assert.match(prompt, /sections/);
  assert.match(prompt, /sourceList/);
  assert.match(prompt, /Do NOT blend disagreements/i);
});

test("regression: still instructs raw JSON only, no markdown fences", () => {
  const prompt = buildSynthesisPrompt({ topic: "X", articles: [] });
  assert.match(prompt, /raw JSON only/i);
  assert.match(prompt, /no markdown code fences/i);
});
