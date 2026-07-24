import test from "node:test";
import assert from "node:assert/strict";
import { extractJson } from "./extract-json.js";

test("parses raw JSON with no fence", () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
});

test("strips a ```json ... ``` fence", () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
});

test("strips a bare ``` ... ``` fence with no language tag", () => {
  assert.deepEqual(extractJson('```\n{"a":1}\n```'), { a: 1 });
});

test("throws on genuinely invalid content", () => {
  assert.throws(() => extractJson("not json at all"));
});
