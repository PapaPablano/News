import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateSynthesis } from "../schema/validate-synthesis.js";

test("fixture archive entry passes validateSynthesis", async () => {
  const raw = await readFile(new URL("./sample-beat/2026-07-24T12-00-00-000Z.json", import.meta.url), "utf8");
  const { valid, errors } = validateSynthesis(JSON.parse(raw));
  assert.equal(valid, true, errors.join("; "));
});

test("fixture index.json points at an existing entry file", async () => {
  const raw = await readFile(new URL("./sample-beat/index.json", import.meta.url), "utf8");
  const index = JSON.parse(raw);
  assert.equal(index.latest, "2026-07-24T12-00-00-000Z.json");
  assert.ok(index.entries.includes(index.latest));
});
