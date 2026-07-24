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

test("rejects a null entry in narrative without throwing", () => {
  const bad = { ...validSample, narrative: [null] };
  const { valid, errors } = validateSynthesis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("narrative[0] must be an object")));
});

test("rejects a non-object entry in disagreementGroups without throwing", () => {
  const bad = { ...validSample, disagreementGroups: ["not an object"] };
  const { valid, errors } = validateSynthesis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("disagreementGroups[0] must be an object")));
});
