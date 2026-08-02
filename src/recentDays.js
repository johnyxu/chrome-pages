export function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRecentDayGroups(links, count = 7) {
  const byDate = new Map();
  for (const link of links) {
    const key = getDateKey(new Date(link.savedAt));
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(link);
  }
  return [...byDate.keys()]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, count)
    .map((date) => ({
      date,
      links: byDate.get(date).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)),
    }));
}
