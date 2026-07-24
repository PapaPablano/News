import test from "node:test";
import assert from "node:assert/strict";
import { validateSynthesis, SCHEMA_VERSION } from "./validate-synthesis.js";

const validSample = {
  schemaVersion: SCHEMA_VERSION,
  generatedAt: "2026-07-24T12:00:00.000Z",
  query: "Zoning change",
  headline: "Council approves zoning change 5-2",
  consensus: "The council approved the zoning change 5-2.",
  sections: [
    {
      subheading: "What happened",
      framingLabel: null,
      sentences: [
        { text: "The council approved the change.", sources: ["AP"], disputed: false }
      ]
    }
  ],
  disagreementGroups: [],
  sourceList: [
    { name: "AP", url: "https://example.com/ap" },
    { name: "Local Tribune", url: "https://example.com/tribune" }
  ]
};

const multiSectionSample = {
  schemaVersion: SCHEMA_VERSION,
  generatedAt: "2026-07-24T12:00:00.000Z",
  query: "Zoning change",
  headline: "Council approves zoning change 5-2",
  consensus: "The council approved the zoning change 5-2.",
  sections: [
    {
      subheading: "What happened",
      framingLabel: "One perspective:",
      sentences: [
        { text: "The council approved the change.", sources: ["AP"], disputed: false },
        { text: "Critics say it skipped public comment.", sources: ["Local Tribune"], disputed: true }
      ]
    },
    {
      subheading: "Reaction",
      framingLabel: null,
      sentences: [
        { text: "Residents were split.", sources: ["AP", "Local Tribune"], disputed: false }
      ]
    }
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

test("accepts a fully valid synthesis object (single section)", () => {
  const { valid, errors } = validateSynthesis(validSample);
  assert.equal(valid, true, errors.join("; "));
  assert.deepEqual(errors, []);
});

test("accepts a fully valid synthesis object with multiple sections, disputed sentences, framingLabel, and disagreementGroups", () => {
  const { valid, errors } = validateSynthesis(multiSectionSample);
  assert.equal(valid, true, errors.join("; "));
  assert.deepEqual(errors, []);
});

test("accepts exactly 1 section (floor case)", () => {
  const { valid, errors } = validateSynthesis(validSample);
  assert.equal(valid, true, errors.join("; "));
  assert.equal(validSample.sections.length, 1);
});

test("accepts framingLabel as null", () => {
  const sample = { ...validSample, sections: [{ ...validSample.sections[0], framingLabel: null }] };
  const { valid, errors } = validateSynthesis(sample);
  assert.equal(valid, true, errors.join("; "));
});

test("accepts framingLabel as a non-empty string", () => {
  const sample = { ...validSample, sections: [{ ...validSample.sections[0], framingLabel: "One perspective:" }] };
  const { valid, errors } = validateSynthesis(sample);
  assert.equal(valid, true, errors.join("; "));
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

test("rejects a missing schemaVersion, naming the missing field", () => {
  const { schemaVersion, ...rest } = validSample;
  const { valid, errors } = validateSynthesis(rest);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("schemaVersion") && e.includes("required")));
});

test("rejects a wrong schemaVersion value, stating expected vs. actual", () => {
  const { valid, errors } = validateSynthesis({ ...validSample, schemaVersion: 1 });
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes(`${SCHEMA_VERSION}`) && e.includes("1")));
});

test("rejects a missing headline", () => {
  const { headline, ...rest } = validSample;
  const { valid, errors } = validateSynthesis(rest);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("headline")));
});

test("rejects an empty headline", () => {
  const { valid, errors } = validateSynthesis({ ...validSample, headline: "" });
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("headline")));
});

test("rejects an empty sections array (floor of 1 enforced)", () => {
  const { valid, errors } = validateSynthesis({ ...validSample, sections: [] });
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("sections")));
});

test("rejects a section missing subheading", () => {
  const bad = {
    ...validSample,
    sections: [{ ...validSample.sections[0], subheading: undefined }]
  };
  const { valid, errors } = validateSynthesis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("subheading")));
});

test("rejects a sentence missing disputed", () => {
  const bad = {
    ...validSample,
    sections: [
      {
        ...validSample.sections[0],
        sentences: [{ text: "x", sources: ["AP"] }]
      }
    ]
  };
  const { valid, errors } = validateSynthesis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("disputed")));
});

test("rejects a sentence with a non-boolean disputed value", () => {
  const bad = {
    ...validSample,
    sections: [
      {
        ...validSample.sections[0],
        sentences: [{ text: "x", sources: ["AP"], disputed: "yes" }]
      }
    ]
  };
  const { valid, errors } = validateSynthesis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("disputed")));
});

test("rejects a sentence's sources referencing a name not present in sourceList", () => {
  const bad = {
    ...validSample,
    sections: [
      {
        ...validSample.sections[0],
        sentences: [{ text: "x", sources: ["Unknown Outlet"], disputed: false }]
      }
    ]
  };
  const { valid, errors } = validateSynthesis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("Unknown Outlet")));
});

test("rejects a non-object entry in sections without throwing", () => {
  const bad = { ...validSample, sections: [null] };
  const { valid, errors } = validateSynthesis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("sections[0] must be an object")));
});

test("rejects a non-object entry in sentences without throwing", () => {
  const bad = {
    ...validSample,
    sections: [{ ...validSample.sections[0], sentences: [null] }]
  };
  const { valid, errors } = validateSynthesis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("sentences[0] must be an object")));
});

test("accepts an empty disagreementGroups array", () => {
  const { valid } = validateSynthesis({ ...validSample, disagreementGroups: [] });
  assert.equal(valid, true);
});

test("rejects a non-object entry in disagreementGroups without throwing", () => {
  const bad = { ...validSample, disagreementGroups: ["not an object"] };
  const { valid, errors } = validateSynthesis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes("disagreementGroups[0] must be an object")));
});
