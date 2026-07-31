export function filterLinks(links, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return links;
  return links.filter(
    (link) =>
      link.title.toLowerCase().includes(normalized) || link.url.toLowerCase().includes(normalized)
  );
}
