import test from "node:test";
import assert from "node:assert/strict";
import { updateIndex } from "./archive-index.js";

test("creates a new index when none existed before", () => {
  const result = updateIndex(null, "2026-07-24T12-00-00-000Z.json");
  assert.deepEqual(result, {
    latest: "2026-07-24T12-00-00-000Z.json",
    entries: ["2026-07-24T12-00-00-000Z.json"]
  });
});

test("appends to an existing index and updates latest", () => {
  const existing = { latest: "2026-07-24T12-00-00-000Z.json", entries: ["2026-07-24T12-00-00-000Z.json"] };
  const result = updateIndex(existing, "2026-07-24T18-00-00-000Z.json");
  assert.deepEqual(result, {
    latest: "2026-07-24T18-00-00-000Z.json",
    entries: ["2026-07-24T12-00-00-000Z.json", "2026-07-24T18-00-00-000Z.json"]
  });
});
