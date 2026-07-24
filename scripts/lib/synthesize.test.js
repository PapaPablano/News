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

test("returns the parsed, validated result when Claude wraps the JSON in a ```json fence", async () => {
  const fenced = "```json\n" + JSON.stringify(validResult) + "\n```";
  const client = fakeClient(fenced);
  const result = await synthesizeBeat({ topic: "Zoning change", articles: [] }, client);
  assert.deepEqual(result, validResult);
});

test("throws when Claude's JSON fails schema validation", async () => {
  const invalid = { ...validResult, narrative: [] };
  const client = fakeClient(JSON.stringify(invalid));
  await assert.rejects(
    () => synthesizeBeat({ topic: "X", articles: [] }, client),
    /failed validation/
  );
});
