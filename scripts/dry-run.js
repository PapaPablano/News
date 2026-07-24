import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { refreshBeat } from "./refresh-beats.js";

const ROOT = path.resolve(import.meta.dirname, "..");

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: node scripts/dry-run.js <beat-slug>");
    process.exit(1);
  }

  const beats = JSON.parse(await fs.readFile(path.join(ROOT, "beats.json"), "utf8"));
  const sources = JSON.parse(await fs.readFile(path.join(ROOT, "sources.json"), "utf8"));
  const beat = beats.find(b => b.slug === slug);

  if (!beat) {
    console.error(`No beat found with slug "${slug}". Available: ${beats.map(b => b.slug).join(", ")}`);
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { result, articleCount } = await refreshBeat({ beat, sources, client });

  if (!result) {
    console.log(`No articles found for "${slug}" — nothing to synthesize.`);
    return;
  }

  console.log(`Collected ${articleCount} articles for "${beat.label}"\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
