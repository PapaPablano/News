import test from "node:test";
import assert from "node:assert/strict";
import { handleSearchRequest } from "./handler.js";

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

test("returns 400 when query is empty", async () => {
  const { status, body } = await handleSearchRequest({ query: "", client: fakeClient(""), model: "m" });
  assert.equal(status, 400);
  assert.match(body.error, /Missing/);
});

test("returns 200 with the validated result on success", async () => {
  const { status, body } = await handleSearchRequest({
    query: "Zoning change",
    client: fakeClient(JSON.stringify(validResult)),
    model: "m"
  });
  assert.equal(status, 200);
  assert.deepEqual(body, validResult);
});

test("returns 502 when Claude's response is not valid JSON", async () => {
  const { status, body } = await handleSearchRequest({
    query: "Zoning change",
    client: fakeClient("not json"),
    model: "m"
  });
  assert.equal(status, 502);
  assert.match(body.error, /did not return valid JSON/);
});

test("returns 502 when the Anthropic call itself throws", async () => {
  const throwingClient = { messages: { create: async () => { throw new Error("rate limited"); } } };
  const { status, body } = await handleSearchRequest({ query: "X", client: throwingClient, model: "m" });
  assert.equal(status, 502);
  assert.match(body.error, /Claude API error/);
});
