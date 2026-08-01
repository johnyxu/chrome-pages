export function getFavorites(links) {
  return links.filter((link) => link.favorite === true);
}

export function toggleFavorite(links, id) {
  return links.map((link) => (link.id === id ? { ...link, favorite: !link.favorite } : link));
}

// Repositions only the entries named in `orderedIds` (a full ordering of the
// current favorites), leaving every other entry exactly where it was. This
// keeps favorite drag-reordering from disturbing the rest of the saved list.
export function reorderFavorites(links, orderedIds) {
  const orderedSet = new Set(orderedIds);
  const byId = new Map(links.map((link) => [link.id, link]));
  const queue = orderedIds.map((id) => byId.get(id));
  let i = 0;
  return links.map((link) => (orderedSet.has(link.id) ? queue[i++] : link));
}

// Gives favorites priority in the main (grouped) view: groups containing at
// least one favorite sort before groups that don't, and within each group,
// favorited links sort before non-favorited ones. Ties keep their existing
// relative order (Array.prototype.sort is stable), so this only re-partitions
// by favorite status — it never reshuffles alphabetical/insertion order
// within a partition.
export function sortGroupsByFavorite(groups) {
  return groups
    .map((group) => ({
      domain: group.domain,
      links: [...group.links].sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))),
    }))
    .sort((a, b) => {
      const aHasFavorite = a.links.some((link) => link.favorite);
      const bHasFavorite = b.links.some((link) => link.favorite);
      return Number(bHasFavorite) - Number(aHasFavorite);
    });
}
