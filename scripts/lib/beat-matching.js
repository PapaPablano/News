export function matchesBeat(item, beat) {
  const haystack = `${item.title} ${item.snippet}`.toLowerCase();
  return beat.searchTerms
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .some(term => haystack.includes(term));
}
