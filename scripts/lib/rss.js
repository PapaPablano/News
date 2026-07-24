import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false });

function stripHtml(html) {
  return String(html).replace(/<[^>]*>/g, "").trim();
}

export function parseFeedXml(xmlText) {
  const doc = parser.parse(xmlText);
  const channel = doc.rss && doc.rss.channel;
  if (!channel) return [];

  const rawItems = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];

  return rawItems.map(item => ({
    title: typeof item.title === "string" ? item.title : "",
    link: typeof item.link === "string" ? item.link : "",
    snippet: typeof item.description === "string" ? stripHtml(item.description) : "",
    pubDate: item.pubDate || null
  }));
}

export async function fetchFeed(url, fetchImpl = fetch) {
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Feed fetch failed (${res.status}): ${url}`);
  }
  const xmlText = await res.text();
  return parseFeedXml(xmlText);
}
