import { renderArticle, escapeHtml } from "./render-article.js";
import { loadBeatSummaries, pickOthers } from "./beat-discovery.js";
import { renderRelatedStrip } from "./related-strip.js";

function renderHistoryStrip(index, slug, activeEntry) {
  if (!Array.isArray(index?.entries)) {
    console.warn("renderHistoryStrip: index.entries is missing or not an array; skipping history strip.");
    return;
  }
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

  let beats;
  let beat;
  try {
    beats = await (await fetch("beats.json")).json();
    beat = beats.find(b => b.slug === slug);
  } catch (err) {
    document.getElementById("beat-title").textContent = "Error";
    document.getElementById("content").innerHTML = `<p class="error">Could not load beats.json.</p>`;
    return;
  }

  if (!beat) {
    document.getElementById("beat-title").textContent = "Unknown beat";
    document.getElementById("content").innerHTML = `<p class="error">No beat found for "${escapeHtml(slug)}".</p>`;
    return;
  }

  document.getElementById("beat-title").textContent = beat.label;

  let index;
  let entryParam;
  try {
    index = await (await fetch(`data/${beat.slug}/index.json`)).json();
    entryParam = params.get("entry") || index.latest;
    const data = await (await fetch(`data/${beat.slug}/${entryParam}`)).json();
    document.getElementById("content").innerHTML = renderArticle(data);
  } catch (err) {
    document.getElementById("content").innerHTML = `<p class="error">No data yet for this beat.</p>`;
    return;
  }

  try {
    renderHistoryStrip(index, slug, entryParam);
  } catch (err) {
    console.warn("renderHistoryStrip failed; leaving rendered article in place.", err);
  }

  try {
    const summaries = await loadBeatSummaries(beats);
    const others = pickOthers(summaries, slug, 3);
    document.getElementById("related-strip").innerHTML = renderRelatedStrip(others);
  } catch (err) {
    console.warn("Related-strip rendering failed; leaving rendered article in place.", err);
  }
}

loadBeatPage();
