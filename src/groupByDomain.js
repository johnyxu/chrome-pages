export function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function groupLinksByDomain(links) {
  const byDomain = new Map();
  for (const link of links) {
    const domain = getDomain(link.url);
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain).push(link);
  }
  return Array.from(byDomain, ([domain, domainLinks]) => ({ domain, links: domainLinks })).sort(
    (a, b) => a.domain.localeCompare(b.domain)
  );
}
