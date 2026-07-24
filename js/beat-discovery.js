// Shared beat-discovery helpers: load per-beat summaries (with per-beat failure
// tolerance) and pick a handful of "other" beats for related-navigation UI.
//
// Generalizes the fetch-index-then-fetch-latest-entry loop that used to live
// inline in front-page.js so beat-page.js and search-page.js can reuse it.

export async function loadBeatSummaries(beats, fetchImpl = fetch) {
  const summaries = [];

  for (const beat of beats) {
    try {
      const index = await (await fetchImpl(`data/${beat.slug}/index.json`)).json();
      const latest = await (await fetchImpl(`data/${beat.slug}/${index.latest}`)).json();
      summaries.push({
        slug: beat.slug,
        label: beat.label,
        headline: latest.headline,
        consensus: latest.consensus,
        generatedAt: latest.generatedAt,
        disagreementGroups: latest.disagreementGroups
      });
    } catch (err) {
      console.warn(`No data yet for beat "${beat.slug}"`, err);
      summaries.push(null);
    }
  }

  return summaries;
}

export function pickOthers(summaries, currentSlug, limit) {
  const others = summaries.filter(summary => summary && summary.slug !== currentSlug);
  return others.slice(0, limit);
}
