export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function chipClass(stance) {
  return stance === "dissenting" ? "chip chip-dissent" : "chip chip-agree";
}

function renderNarrative(narrative) {
  return narrative
    .map(entry => {
      const chips = entry.sources
        .map(s => `<span class="${chipClass(entry.stance)}">${escapeHtml(s)}</span>`)
        .join(" ");
      return `<p>${escapeHtml(entry.text)} ${chips}</p>`;
    })
    .join("\n");
}

function renderDisagreements(groups) {
  if (groups.length === 0) {
    return `<p class="muted">No notable disagreement between sources.</p>`;
  }
  return groups
    .map(
      group =>
        `<div class="disagreement-group"><h4>${escapeHtml(group.stance)}</h4><p>${group.sources
          .map(escapeHtml)
          .join(", ")}</p></div>`
    )
    .join("\n");
}

export function renderArticle(data) {
  return `
    <article>
      <div class="narrative">${renderNarrative(data.narrative)}</div>
      <hr>
      <section class="snapshot">
        <p class="label">Snapshot</p>
        <p class="consensus">${escapeHtml(data.consensus)}</p>
        <div class="disagreements">${renderDisagreements(data.disagreementGroups)}</div>
      </section>
    </article>
  `;
}
