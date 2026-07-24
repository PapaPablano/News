import { escapeHtml } from "./render-article.js";
import { loadBeatSummaries } from "./beat-discovery.js";

function renderDisagreementIndicator(disagreementGroups) {
  if (!disagreementGroups || disagreementGroups.length === 0) return "";
  return `<span class="disagreement-indicator">⚠ Sources disagree</span>`;
}

function renderBeatCard(summary) {
  const headlineText = summary.headline || summary.consensus;
  return `
    <a class="beat-card" href="beat.html?beat=${encodeURIComponent(summary.slug)}">
      <h3>${escapeHtml(summary.label)}</h3>
      <p>${escapeHtml(headlineText)}${renderDisagreementIndicator(summary.disagreementGroups)}</p>
      <p class="timestamp">${new Date(summary.generatedAt).toLocaleString()}</p>
    </a>
  `;
}

function renderMutedCard(label) {
  return `<div class="beat-card muted">${escapeHtml(label)} — no data yet</div>`;
}

async function loadBeats() {
  let beats;
  try {
    beats = await (await fetch("beats.json")).json();
  } catch (err) {
    console.warn("Could not load beats.json", err);
    const container = document.getElementById("beats");
    if (container) {
      container.innerHTML = `<p class="error">Could not load beats.json.</p>`;
    }
    return;
  }

  const container = document.getElementById("beats");
  container.innerHTML = "";

  const summaries = await loadBeatSummaries(beats);

  beats.forEach((beat, i) => {
    const summary = summaries[i];
    container.insertAdjacentHTML(
      "beforeend",
      summary ? renderBeatCard(summary) : renderMutedCard(beat.label)
    );
  });
}

loadBeats();
