export function tabsToEntries(tabs, deps = {}) {
  const now = deps.now || (() => new Date().toISOString());
  const idGen = deps.idGen || (() => crypto.randomUUID());
  return tabs
    .filter((tab) => typeof tab.url === 'string' && tab.url.length > 0)
    .map((tab) => ({
      id: idGen(),
      url: tab.url,
      title: tab.title || tab.url,
      savedAt: now(),
    }));
}
