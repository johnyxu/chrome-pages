export function parseLinksFile(text) {
  if (!text || text.trim() === '') {
    return { links: [], corrupted: false };
  }
  try {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.links)) {
      return { links: [], corrupted: true };
    }
    return { links: data.links, corrupted: false };
  } catch {
    return { links: [], corrupted: true };
  }
}

export function serializeLinksFile(links) {
  return JSON.stringify({ links }, null, 2);
}
