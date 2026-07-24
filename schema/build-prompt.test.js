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
