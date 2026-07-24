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
