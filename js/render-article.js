export const EXPECTED_SCHEMA_VERSION = 2;

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderOlderFormatFallback() {
  return `
    <article>
      <p class="fallback-message fallback-message--older-format">This is an older article that predates the current site design.</p>
    </article>
  `;
}

function renderRefreshFallback() {
  return `
    <article>
      <p class="fallback-message fallback-message--refresh">This article needs a newer version of the site to display correctly — try refreshing.</p>
    </article>
  `;
}

function renderDisagreementIndicator(disagreementGroups) {
  if (!disagreementGroups || disagreementGroups.length === 0) return "";
  return `<a href="#snapshot" class="disagreement-indicator disagreement-indicator--link">⚠ Sources disagree</a>`;
}

function renderHeadline(headline, disagreementGroups) {
  return `<h1>${escapeHtml(headline)}</h1>${renderDisagreementIndicator(disagreementGroups)}`;
}

function renderFramingLabel(framingLabel) {
  if (!framingLabel) return "";
  return `<strong class="framing-label">${escapeHtml(framingLabel)}</strong> `;
}

function renderSentence(sentence) {
  const text = escapeHtml(sentence.text);
  return sentence.disputed ? `<span class="disputed-sentence">${text}</span>` : text;
}

function renderSectionSources(sentences) {
  const seen = new Set();
  const names = [];
  sentences.forEach(sentence => {
    (sentence.sources || []).forEach(name => {
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    });
  });
  return `<p class="section-sources">Sources: ${names.map(escapeHtml).join(", ")}</p>`;
}

function renderSection(section) {
  const paragraph = section.sentences.map(renderSentence).join(" ");
  return `
    <div class="section">
      <h3>${escapeHtml(section.subheading)}</h3>
      <p>${renderFramingLabel(section.framingLabel)}${paragraph}</p>
      ${renderSectionSources(section.sentences)}
    </div>
  `;
}

function renderSections(sections) {
  return sections.map(renderSection).join("\n");
}

function renderDisagreements(groups) {
  if (groups.length === 0) {
    return `<p class="muted">No disagreement detected among sources reviewed.</p>`;
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
  if (data.schemaVersion === undefined) {
    return renderOlderFormatFallback();
  }
  if (data.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    return renderRefreshFallback();
  }

  return `
    <article>
      ${renderHeadline(data.headline, data.disagreementGroups)}
      <div class="sections">${renderSections(data.sections)}</div>
      <hr>
      <section class="snapshot" id="snapshot">
        <p class="label">Snapshot</p>
        <p class="consensus">${escapeHtml(data.consensus)}</p>
        <div class="disagreements">${renderDisagreements(data.disagreementGroups)}</div>
      </section>
    </article>
  `;
}
