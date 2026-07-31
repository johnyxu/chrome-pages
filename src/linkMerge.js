export function mergeLinks(existingLinks, newEntries) {
  const seenUrls = new Set(existingLinks.map((link) => link.url));
  const added = [];
  for (const entry of newEntries) {
    if (seenUrls.has(entry.url)) continue;
    seenUrls.add(entry.url);
    added.push(entry);
  }
  return {
    links: [...existingLinks, ...added],
    addedCount: added.length,
    skippedCount: newEntries.length - added.length,
  };
}

export function removeLink(links, id) {
  return links.filter((link) => link.id !== id);
}
