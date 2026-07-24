import Anthropic from "@anthropic-ai/sdk";
import { handleSearchRequest } from "./handler.js";
import { rateLimitKeyForHour, isOverLimit } from "./rate-limit.js";

const RATE_LIMIT_PER_HOUR = 30;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Search-Proxy-Secret"
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed" });
    }

    const providedSecret = request.headers.get("X-Search-Proxy-Secret");
    if (!providedSecret || providedSecret !== env.SEARCH_PROXY_SECRET) {
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const rateLimitKey = rateLimitKeyForHour();
    const currentCountRaw = await env.RATE_LIMIT_KV.get(rateLimitKey);
    const currentCount = currentCountRaw ? parseInt(currentCountRaw, 10) : 0;
    if (isOverLimit(currentCount, RATE_LIMIT_PER_HOUR)) {
      return jsonResponse(429, { error: "Rate limit exceeded, try again later" });
    }
    // expirationTtl comfortably outlives the hour bucket so a slightly-late
    // write near the boundary still expires instead of leaking into the next.
    await env.RATE_LIMIT_KV.put(rateLimitKey, String(currentCount + 1), { expirationTtl: 3700 });

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const { status, body: resultBody } = await handleSearchRequest({
      query: typeof body.query === "string" ? body.query.trim() : "",
      client,
      model: env.ANTHROPIC_MODEL || "claude-sonnet-5"
    });

    return jsonResponse(status, resultBody);
  }
};
