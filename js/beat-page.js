import { renderArticle } from "./render-article.js";

function renderHistoryStrip(index, slug, activeEntry) {
  const strip = document.getElementById("history");
  strip.innerHTML = index.entries
    .slice()
    .reverse()
    .map(entry => {
      const label = entry.replace(/\.json$/, "");
      const activeClass = entry === activeEntry ? "history-item active" : "history-item";
      return `<a class="${activeClass}" href="beat.html?beat=${encodeURIComponent(slug)}&entry=${encodeURIComponent(entry)}">${label}</a>`;
    })
    .join(" ");
}

async function loadBeatPage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("beat");
  const beats = await (await fetch("beats.json")).json();
  const beat = beats.find(b => b.slug === slug);

  if (!beat) {
    document.getElementById("beat-title").textContent = "Unknown beat";
    document.getElementById("content").innerHTML = `<p class="error">No beat found for "${slug}".</p>`;
    return;
  }

  document.getElementById("beat-title").textContent = beat.label;

  try {
    const index = await (await fetch(`data/${beat.slug}/index.json`)).json();
    const entryParam = params.get("entry") || index.latest;
    const data = await (await fetch(`data/${beat.slug}/${entryParam}`)).json();
    document.getElementById("content").innerHTML = renderArticle(data);
    renderHistoryStrip(index, slug, entryParam);
  } catch (err) {
    document.getElementById("content").innerHTML = `<p class="error">No data yet for this beat.</p>`;
  }
}

loadBeatPage();
