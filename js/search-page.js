import { renderArticle } from "./render-article.js";

const WORKER_URL = "https://news-synthesis-worker.epeterson0076.workers.dev";
const SEARCH_PROXY_SECRET = "194d61fa03cfa2b2cf9183d573988a0ab876eddebff7a733271c4bcc63eb0b2e";

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
