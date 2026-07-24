import test from "node:test";
import assert from "node:assert/strict";
import { rateLimitKeyForHour, isOverLimit } from "./rate-limit.js";

test("rateLimitKeyForHour buckets by hour, not minute", () => {
  assert.equal(rateLimitKeyForHour(new Date("2026-07-24T18:05:00Z")), "ratelimit:2026-07-24T18");
  assert.equal(rateLimitKeyForHour(new Date("2026-07-24T18:59:59Z")), "ratelimit:2026-07-24T18");
});

test("rateLimitKeyForHour changes key at the hour boundary", () => {
  assert.equal(rateLimitKeyForHour(new Date("2026-07-24T19:00:00Z")), "ratelimit:2026-07-24T19");
});

test("isOverLimit returns false below the limit", () => {
  assert.equal(isOverLimit(5, 30), false);
});

test("isOverLimit returns true at or above the limit", () => {
  assert.equal(isOverLimit(30, 30), true);
  assert.equal(isOverLimit(31, 30), true);
});
