import { renderArticle, escapeHtml } from "./render-article.js";
import { loadBeatSummaries, pickOthers } from "./beat-discovery.js";
import { renderRelatedStrip } from "./related-strip.js";

const WORKER_URL = "https://news-synthesis-worker.epeterson0076.workers.dev";
const SEARCH_PROXY_SECRET = "194d61fa03cfa2b2cf9183d573988a0ab876eddebff7a733271c4bcc63eb0b2e";

async function handleSearch(event) {
  event.preventDefault();
  const query = document.getElementById("query").value.trim();
  if (!query) return;

  const content = document.getElementById("content");
  const relatedStrip = document.getElementById("related-strip");
  content.innerHTML = "<p>Searching… this can take up to 30 seconds since we check live sources.</p>";
  if (relatedStrip) relatedStrip.innerHTML = "";

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Search-Proxy-Secret": SEARCH_PROXY_SECRET
      },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Search failed (${res.status})`);
    }
    content.innerHTML = renderArticle(data);
  } catch (err) {
    content.innerHTML = `<p class="error">Search failed, try again. (${escapeHtml(err.message)})</p><button type="button" id="retry-search">Retry</button>`;
    document.getElementById("retry-search").addEventListener("click", handleSearch);
    return;
  }

  try {
    const beats = await (await fetch("beats.json")).json();
    const summaries = await loadBeatSummaries(beats);
    const others = pickOthers(summaries, null, 3);
    if (relatedStrip) relatedStrip.innerHTML = renderRelatedStrip(others);
  } catch (err) {
    console.warn("Related-strip rendering failed; leaving rendered article in place.", err);
  }
}

document.getElementById("search-form").addEventListener("submit", handleSearch);
