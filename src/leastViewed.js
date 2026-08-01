// Records that a saved link was opened. Links start with no `openCount` at
// all (never saved to disk until the first open), so a missing value reads
// as 0 rather than requiring every existing saved-tabs.json to be migrated.
export function incrementOpenCount(links, id) {
  return links.map((link) => (link.id === id ? { ...link, openCount: (link.openCount || 0) + 1 } : link));
}

// Surfaces the links most worth revisiting: least-opened first, and among
// links with the same open count (including links never opened at all),
// the oldest saved link first. Array.prototype.sort is not required to be
// stable across engines for arbitrary compare functions, but the tie-break
// here is explicit (savedAt), so no comparison ever depends on input order.
export function getLeastViewed(links, count = 5) {
  return [...links]
    .sort((a, b) => {
      const countDiff = (a.openCount || 0) - (b.openCount || 0);
      if (countDiff !== 0) return countDiff;
      return new Date(a.savedAt) - new Date(b.savedAt);
    })
    .slice(0, count);
}
