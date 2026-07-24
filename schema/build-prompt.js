import { SCHEMA_VERSION } from "./validate-synthesis.js";

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
  "schemaVersion": ${SCHEMA_VERSION},
  "generatedAt": "<ISO-8601 timestamp for right now>",
  "query": "${topic}",
  "headline": "<a short, neutral, single-sentence headline for the story>",
  "consensus": "<one neutral sentence stating what sources agree happened>",
  "sections": [
    {
      "subheading": "<a short theme label for this section, e.g. 'What happened' or 'Reaction'>",
      "framingLabel": "<a short paired label like 'One perspective:' or 'Another angle:' when this section reflects one side of a cross-section disagreement, otherwise null>",
      "sentences": [
        { "text": "<a sentence or clause of the story>", "sources": ["<outlet name>"], "disputed": true | false }
      ]
    }
  ],
  "disagreementGroups": [
    { "stance": "<short label for a framing/position>", "sources": ["<outlet name>"] }
  ],
  "sourceList": [ { "name": "<outlet name>", "url": "<article url>" } ]
}

Rules:
- Organize the body into 2-4 themed "sections", each with its own "subheading" and a short run of flowing prose sentences. This is a floor of 1, not a target: a genuinely thin story with little material should get exactly 1 section rather than being padded out to reach 2-4. Never invent filler content just to hit a section count.
- Every outlet name used in "sources" (in any section's sentences, or in disagreementGroups) must also appear in "sourceList".
- Do NOT blend disagreements between sources into a single flattened take. If outlets frame the story differently, mark the specific sentences that are contested with "disputed": true, and represent cross-section framing differences via paired "framingLabel" values on the relevant sections, and via "disagreementGroups". A story with no real disagreement can have an empty "disagreementGroups" array, all sentences "disputed": false, and "framingLabel": null on every section.
- Each section's "sentences" should read as coherent flowing prose when its "text" fields are concatenated with spaces.
- Output raw JSON only — no markdown code fences, no leading or trailing commentary.`;
}
