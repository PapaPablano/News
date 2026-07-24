// Claude is instructed to output raw JSON only, but sometimes wraps its
// response in a markdown code fence anyway (```json ... ``` or ``` ... ```).
// Strip that fence if present before parsing, so a stray fence doesn't
// surface as "did not return valid JSON" for an otherwise-valid response.
export function extractJson(text) {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const jsonText = fenceMatch ? fenceMatch[1] : trimmed;
  return JSON.parse(jsonText);
}
