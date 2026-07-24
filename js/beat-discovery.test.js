import test from "node:test";
import assert from "node:assert/strict";
import { loadBeatSummaries, pickOthers } from "./beat-discovery.js";

function jsonResponse(body) {
  return { json: async () => body };
}

// Fake fetchImpl backed by a map of url -> JSON body (or a thrown error marker).
function makeFakeFetch(routes) {
  return async url => {
    if (!(url in routes)) {
      throw new Error(`Unexpected fetch: ${url}`);
    }
    const entry = routes[url];
    if (entry instanceof Error) {
      throw entry;
    }
    return jsonResponse(entry);
  };
}

const beats = [
  { slug: "tech", label: "Technology" },
  { slug: "climate", label: "Climate" },
  { slug: "politics", label: "Politics" }
];

test("loadBeatSummaries happy path: all beats resolve in input order, including disagreementGroups", async () => {
  const fetchImpl = makeFakeFetch({
    "data/tech/index.json": { latest: "2026-07-24.json" },
    "data/tech/2026-07-24.json": {
      headline: "Tech headline",
      consensus: "Tech consensus",
      generatedAt: "2026-07-24T00:00:00.000Z",
      disagreementGroups: [{ stance: "a", sources: ["X"] }]
    },
    "data/climate/index.json": { latest: "2026-07-23.json" },
    "data/climate/2026-07-23.json": {
      headline: "Climate headline",
      consensus: "Climate consensus",
      generatedAt: "2026-07-23T00:00:00.000Z",
      disagreementGroups: []
    },
    "data/politics/index.json": { latest: "2026-07-22.json" },
    "data/politics/2026-07-22.json": {
      headline: "Politics headline",
      consensus: "Politics consensus",
      generatedAt: "2026-07-22T00:00:00.000Z",
      disagreementGroups: []
    }
  });

  const summaries = await loadBeatSummaries(beats, fetchImpl);

  assert.equal(summaries.length, 3);
  assert.deepEqual(summaries[0], {
    slug: "tech",
    label: "Technology",
    headline: "Tech headline",
    consensus: "Tech consensus",
    generatedAt: "2026-07-24T00:00:00.000Z",
    disagreementGroups: [{ stance: "a", sources: ["X"] }]
  });
  assert.equal(summaries[1].slug, "climate");
  assert.equal(summaries[2].slug, "politics");
});

test("loadBeatSummaries edge case: one beat's fetch fails -> that entry is null, others unaffected", async () => {
  const fetchImpl = makeFakeFetch({
    "data/tech/index.json": { latest: "2026-07-24.json" },
    "data/tech/2026-07-24.json": {
      headline: "Tech headline",
      consensus: "Tech consensus",
      generatedAt: "2026-07-24T00:00:00.000Z",
      disagreementGroups: []
    },
    "data/climate/index.json": new Error("404 not found"),
    "data/politics/index.json": { latest: "2026-07-22.json" },
    "data/politics/2026-07-22.json": {
      headline: "Politics headline",
      consensus: "Politics consensus",
      generatedAt: "2026-07-22T00:00:00.000Z",
      disagreementGroups: []
    }
  });

  const summaries = await loadBeatSummaries(beats, fetchImpl);

  assert.equal(summaries.length, 3);
  assert.equal(summaries[0].slug, "tech");
  assert.equal(summaries[1], null);
  assert.equal(summaries[2].slug, "politics");
});

test("loadBeatSummaries edge case: empty beats array returns empty array", async () => {
  const fetchImpl = makeFakeFetch({});
  const summaries = await loadBeatSummaries([], fetchImpl);
  assert.deepEqual(summaries, []);
});

test("pickOthers happy path: excludes current slug, returns first N remaining in order", () => {
  const summaries = [
    { slug: "tech", label: "Technology" },
    { slug: "climate", label: "Climate" },
    { slug: "politics", label: "Politics" },
    { slug: "sports", label: "Sports" }
  ];

  const result = pickOthers(summaries, "climate", 2);

  assert.deepEqual(result.map(s => s.slug), ["tech", "politics"]);
});

test("pickOthers edge case: fewer than N others available -> returns what's available", () => {
  const summaries = [
    { slug: "tech", label: "Technology" },
    { slug: "climate", label: "Climate" }
  ];

  const result = pickOthers(summaries, "tech", 5);

  assert.deepEqual(result.map(s => s.slug), ["climate"]);
});

test("pickOthers edge case: no others available -> returns an empty array", () => {
  const summaries = [{ slug: "tech", label: "Technology" }];

  const result = pickOthers(summaries, "tech", 3);

  assert.deepEqual(result, []);
});

test("pickOthers edge case: null entries (failed beats) are excluded from consideration", () => {
  const summaries = [
    { slug: "tech", label: "Technology" },
    null,
    { slug: "politics", label: "Politics" }
  ];

  const result = pickOthers(summaries, "tech", 5);

  assert.deepEqual(result.map(s => s.slug), ["politics"]);
});
