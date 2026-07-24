import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { fetchFeed } from "./lib/rss.js";
import { matchesBeat } from "./lib/beat-matching.js";
import { updateIndex } from "./lib/archive-index.js";
import { synthesizeBeat } from "./lib/synthesize.js";

const ROOT = path.resolve(import.meta.dirname, "..");

async function loadJson(relPath) {
  const raw = await fs.readFile(path.join(ROOT, relPath), "utf8");
  return JSON.parse(raw);
}

function sourceNameForUrl(url, sources) {
  const match = sources.find(s => s.feedUrl === url);
  return match ? match.name : "Google News";
}

function googleNewsUrl(searchTerms) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerms)}&hl=en-US&gl=US&ceid=US:en`;
}

export async function collectArticles(beat, sources) {
  const feedUrls = [googleNewsUrl(beat.searchTerms), ...sources.map(s => s.feedUrl)];
  const articles = [];

  for (const url of feedUrls) {
    try {
      const items = await fetchFeed(url);
      for (const item of items) {
        if (matchesBeat(item, beat)) {
          articles.push({
            source: sourceNameForUrl(url, sources),
            title: item.title,
            snippet: item.snippet,
            url: item.link
          });
        }
      }
    } catch (err) {
      console.warn(`Feed failed, skipping: ${url}\n${err.message}`);
    }
  }

  return articles;
}

export async function refreshBeat({ beat, sources, client }) {
  const articles = await collectArticles(beat, sources);
  if (articles.length === 0) {
    return { result: null, articleCount: 0 };
  }
  const result = await synthesizeBeat({ topic: beat.label, articles }, client);
  return { result, articleCount: articles.length };
}

async function writeArchiveEntry(slug, result) {
  const dir = path.join(ROOT, "data", slug);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${result.generatedAt.replace(/[:.]/g, "-")}.json`;
  await fs.writeFile(path.join(dir, filename), JSON.stringify(result, null, 2));

  const indexPath = path.join(dir, "index.json");
  let existingIndex = null;
  try {
    existingIndex = JSON.parse(await fs.readFile(indexPath, "utf8"));
  } catch {
    // no existing index yet — updateIndex handles null
  }
  await fs.writeFile(indexPath, JSON.stringify(updateIndex(existingIndex, filename), null, 2));
}

async function main() {
  const beats = await loadJson("beats.json");
  const sources = await loadJson("sources.json");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  for (const beat of beats) {
    const { result, articleCount } = await refreshBeat({ beat, sources, client });
    if (!result) {
      console.warn(`Skipping beat "${beat.slug}": no articles found from any source`);
      continue;
    }
    await writeArchiveEntry(beat.slug, result);
    console.log(`Refreshed "${beat.slug}" from ${articleCount} articles`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
