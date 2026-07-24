import test from "node:test";
import assert from "node:assert/strict";
import { collectArticles } from "./refresh-beats.js";

const MAX_ARTICLES_PER_BEAT = 15;

function buildRssWithItems(count) {
  const items = Array.from({ length: count }, (_, i) => `
    <item>
      <title>Breaking news story ${i}</title>
      <link>https://example.com/story${i}</link>
      <description>Some news description ${i}</description>
      <pubDate>Fri, 24 Jul 2026 12:00:00 GMT</pubDate>
    </item>`).join("");

  return `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Sample Feed</title>
    ${items}
  </channel>
</rss>`;
}

test("collectArticles caps the returned articles at MAX_ARTICLES_PER_BEAT even when more match", async () => {
  const beat = { slug: "broad-beat", label: "Broad Beat", searchTerms: "news" };
  const sources = [];
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => buildRssWithItems(20)
  });

  const articles = await collectArticles(beat, sources, fakeFetch);
  assert.equal(articles.length, MAX_ARTICLES_PER_BEAT);
});

test("collectArticles returns fewer than the cap when fewer articles match", async () => {
  const beat = { slug: "narrow-beat", label: "Narrow Beat", searchTerms: "news" };
  const sources = [];
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => buildRssWithItems(5)
  });

  const articles = await collectArticles(beat, sources, fakeFetch);
  assert.equal(articles.length, 5);
});
