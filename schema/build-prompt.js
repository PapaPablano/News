export function buildSynthesisPrompt({ topic, articles }) {
  const hasArticles = Array.isArray(articles) && articles.length > 0;

  const sourceInstructions = hasArticles
    ? `Synthesize coverage of "${topic}" using only the following articles:\n\n` +
      articles
        .map((a, i) => `[${i + 1}] ${a.source}: "${a.title}"\n${a.snippet}\nURL: ${a.url}`)
        .join("\n\n")
    : `Use your web search tool to find current, credible news coverage of "${topic}" from at least 3 distinct outlets, then synthesize it.`;

  return `${sourceInstructions}

Write the synthesis as a single JSON object (and nothing else — no markdown fences, no commentary) with exactly this shape:

{
  "generatedAt": "<ISO-8601 timestamp for right now>",
  "query": "${topic}",
  "consensus": "<one neutral sentence stating what sources agree happened>",
  "narrative": [
    { "text": "<a sentence or clause of the story>", "sources": ["<outlet name>"], "stance": "corroborating" | "dissenting" }
  ],
  "disagreementGroups": [
    { "stance": "<short label for a framing/position>", "sources": ["<outlet name>"] }
  ],
  "sourceList": [ { "name": "<outlet name>", "url": "<article url>" } ]
}

Rules:
- Every outlet name used in "sources" (in narrative or disagreementGroups) must also appear in "sourceList".
- Do NOT blend disagreements between sources into a single flattened take. If outlets frame the story differently, represent that explicitly via "stance" in narrative entries and via "disagreementGroups". A story with no real disagreement can have an empty "disagreementGroups" array.
- "narrative" should read as a coherent short article when its "text" fields are concatenated with spaces.
- Output raw JSON only — no markdown code fences, no leading or trailing commentary.`;
}
