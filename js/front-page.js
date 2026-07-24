import { escapeHtml } from "./render-article.js";

function renderBeatCard(beat, latest) {
  return `
    <a class="beat-card" href="beat.html?beat=${encodeURIComponent(beat.slug)}">
      <h3>${escapeHtml(beat.label)}</h3>
      <p>${escapeHtml(latest.consensus)}</p>
      <p class="timestamp">${new Date(latest.generatedAt).toLocaleString()}</p>
    </a>
  `;
}

async function loadBeats() {
  const beats = await (await fetch("beats.json")).json();
  const container = document.getElementById("beats");
  container.innerHTML = "";

  for (const beat of beats) {
    try {
      const index = await (await fetch(`data/${beat.slug}/index.json`)).json();
      const latest = await (await fetch(`data/${beat.slug}/${index.latest}`)).json();
      container.insertAdjacentHTML("beforeend", renderBeatCard(beat, latest));
    } catch (err) {
      console.warn(`No data yet for beat "${beat.slug}"`, err);
      container.insertAdjacentHTML(
        "beforeend",
        `<div class="beat-card muted">${escapeHtml(beat.label)} — no data yet</div>`
      );
    }
  }
}

loadBeats();
