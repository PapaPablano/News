import Anthropic from "@anthropic-ai/sdk";
import { handleSearchRequest } from "./handler.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
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
