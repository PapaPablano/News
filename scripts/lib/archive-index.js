export function updateIndex(existingIndex, filename) {
  const entries = [...(existingIndex?.entries || []), filename];
  return { latest: filename, entries };
}
