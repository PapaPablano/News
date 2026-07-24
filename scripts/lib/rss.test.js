import test from "node:test";
import assert from "node:assert/strict";
import { parseFeedXml, fetchFeed } from "./rss.js";

const sampleRss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Sample Feed</title>
    <item>
      <title>Council approves zoning change</title>
      <link>https://example.com/story1</link>
      <description>&lt;p&gt;The council voted 5-2.&lt;/p&gt;</description>
      <pubDate>Fri, 24 Jul 2026 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second story</title>
      <link>https://example.com/story2</link>
      <description>Plain text description</description>
      <pubDate>Fri, 24 Jul 2026 13:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

test("parseFeedXml extracts items with stripped HTML descriptions", () => {
  const items = parseFeedXml(sampleRss);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Council approves zoning change");
  assert.equal(items[0].link, "https://example.com/story1");
  assert.equal(items[0].snippet, "The council voted 5-2.");
  assert.equal(items[1].snippet, "Plain text description");
});

test("parseFeedXml returns an empty array for a feed with no items", () => {
  const empty = `<?xml version="1.0"?><rss version="2.0"><channel><title>Empty</title></channel></rss>`;
  assert.deepEqual(parseFeedXml(empty), []);
});

test("parseFeedXml returns an empty array for non-RSS XML", () => {
  assert.deepEqual(parseFeedXml(`<?xml version="1.0"?><notrss></notrss>`), []);
});

test("fetchFeed throws on a non-OK response", async () => {
  const fakeFetch = async () => ({ ok: false, status: 404, text: async () => "" });
  await assert.rejects(() => fetchFeed("https://example.com/missing.xml", fakeFetch), /404/);
});

test("fetchFeed returns parsed items on success", async () => {
  const fakeFetch = async () => ({ ok: true, status: 200, text: async () => sampleRss });
  const items = await fetchFeed("https://example.com/feed.xml", fakeFetch);
  assert.equal(items.length, 2);
});
