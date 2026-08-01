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
