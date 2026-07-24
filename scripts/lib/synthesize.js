import { buildSynthesisPrompt } from "../../schema/build-prompt.js";
import { validateSynthesis } from "../../schema/validate-synthesis.js";
import { extractJson } from "../../schema/extract-json.js";

export async function synthesizeBeat({ topic, articles }, client) {
  const prompt = buildSynthesisPrompt({ topic, articles });

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }]
  });

  const text = response.content
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("");

  let parsed;
  try {
    parsed = extractJson(text);
  } catch (err) {
    throw new Error(`Claude did not return valid JSON: ${err.message}`);
  }

  const { valid, errors } = validateSynthesis(parsed);
  if (!valid) {
    throw new Error(`Synthesis output failed validation:\n${errors.join("\n")}`);
  }

  return parsed;
}
