import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateSynthesis } from "../schema/validate-synthesis.js";

test("fixture archive entry passes validateSynthesis", async () => {
  const raw = await readFile(new URL("./sample-beat/2026-07-24T12-00-00-000Z.json", import.meta.url), "utf8");
  const { valid, errors } = validateSynthesis(JSON.parse(raw));
  assert.equal(valid, true, errors.join("; "));
});

test("index.json points at an existing entry file", async () => {
  // sample-beat is also the demo beat the live scheduled workflow refreshes,
  // so index.json accumulates real entries over time alongside the original
  // fixture — assert general correctness, not a specific "latest" filename.
  const raw = await readFile(new URL("./sample-beat/index.json", import.meta.url), "utf8");
  const index = JSON.parse(raw);
  assert.ok(index.entries.includes(index.latest), `entries should include latest (${index.latest})`);
  assert.ok(index.entries.includes("2026-07-24T12-00-00-000Z.json"), "original fixture entry should still be listed");
});
