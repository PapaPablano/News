import test from "node:test";
import assert from "node:assert/strict";
import { renderRelatedStrip } from "./related-strip.js";

test("renderRelatedStrip happy path: 2 summaries with headlines -> 2 links with correct hrefs and headline text", () => {
  const summaries = [
    { slug: "tech", label: "Technology", headline: "Tech headline", consensus: "Tech consensus" },
    { slug: "climate", label: "Climate", headline: "Climate headline", consensus: "Climate consensus" }
  ];

  const html = renderRelatedStrip(summaries);

  assert.equal((html.match(/<a /g) || []).length, 2);
  assert.match(html, /href="beat\.html\?beat=tech"/);
  assert.match(html, /href="beat\.html\?beat=climate"/);
  assert.match(html, />Tech headline</);
  assert.match(html, />Climate headline</);
});

test("renderRelatedStrip edge case: empty summaries array -> empty string", () => {
  const html = renderRelatedStrip([]);
  assert.equal(html, "");
});

test("renderRelatedStrip regression guard: missing headline falls back to consensus, not 'undefined' or blank", () => {
  const summaries = [
    { slug: "politics", label: "Politics", headline: undefined, consensus: "Politics consensus" }
  ];

  const html = renderRelatedStrip(summaries);

  assert.match(html, />Politics consensus</);
  assert.doesNotMatch(html, /undefined/);
});

test("renderRelatedStrip regression check: HTML in label/headline/consensus is escaped", () => {
  const summaries = [
    {
      slug: "tech",
      label: "<script>alert('label')</script>",
      headline: "<script>alert('headline')</script>",
      consensus: "<script>alert('consensus')</script>"
    }
  ];

  const html = renderRelatedStrip(summaries);

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
