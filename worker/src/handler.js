import { buildSynthesisPrompt } from "../../schema/build-prompt.js";
import { validateSynthesis } from "../../schema/validate-synthesis.js";
import { extractJson } from "../../schema/extract-json.js";

export async function handleSearchRequest({ query, client, model }) {
  if (!query) {
    return { status: 400, body: { error: "Missing 'query' field" } };
  }

  const prompt = buildSynthesisPrompt({ topic: query, articles: [] });

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 16000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }]
    });
  } catch (err) {
    return { status: 502, body: { error: `Claude API error: ${err.message}` } };
  }

  const text = response.content
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("");

  let parsed;
  try {
    parsed = extractJson(text);
  } catch (err) {
    return { status: 502, body: { error: `Claude did not return valid JSON: ${err.message}` } };
  }

  const { valid, errors } = validateSynthesis(parsed);
  if (!valid) {
    return { status: 502, body: { error: `Synthesis output failed validation: ${errors.join("; ")}` } };
  }

  return { status: 200, body: parsed };
}
