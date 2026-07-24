// Renders the "More from your beats" related-beats navigation strip (R7).
//
// A small, self-contained "list of links" component, structurally analogous
// to beat-page.js's history-strip rendering, but kept in its own module per
// the plan's Key Technical Decisions: a navigation strip is a distinct
// concern from synthesis rendering and shouldn't grow render-article.js.

import { escapeHtml } from "./render-article.js";

export function renderRelatedStrip(summaries) {
  if (!Array.isArray(summaries) || summaries.length === 0) {
    return "";
  }

  const links = summaries
    .map(summary => {
      const text = summary.headline || summary.consensus;
      return `<a class="related-strip-item" href="beat.html?beat=${encodeURIComponent(summary.slug)}">${escapeHtml(text)}</a>`;
    })
    .join(" ");

  return `<div class="related-strip">${links}</div>`;
}
