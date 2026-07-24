import { renderArticle } from "./render-article.js";

// Updated in Task 16 once the Worker is deployed and its real URL is known.
const WORKER_URL = "https://news-synthesis-worker.YOUR-SUBDOMAIN.workers.dev";
// Updated in Task 16 once the Worker's SEARCH_PROXY_SECRET is set.
const SEARCH_PROXY_SECRET = "REPLACE-AFTER-DEPLOY";

async function handleSearch(event) {
  event.preventDefault();
  const query = document.getElementById("query").value.trim();
  if (!query) return;

  const content = document.getElementById("content");
  content.innerHTML = "<p>Searching…</p>";

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
    content.innerHTML = `<p class="error">Search failed, try again. (${err.message})</p>`;
  }
}

document.getElementById("search-form").addEventListener("submit", handleSearch);
