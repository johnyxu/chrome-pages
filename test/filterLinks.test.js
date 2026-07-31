import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterLinks } from '../src/filterLinks.js';

const links = [
  { id: '1', url: 'https://example.com/docs', title: 'Example Docs', savedAt: 't1' },
  { id: '2', url: 'https://github.com/foo/bar', title: 'foo/bar: a repo', savedAt: 't2' },
  { id: '3', url: 'https://news.ycombinator.com', title: 'Hacker News', savedAt: 't3' },
];

test('filterLinks returns all links when the query is empty or whitespace', () => {
  assert.deepEqual(filterLinks(links, ''), links);
  assert.deepEqual(filterLinks(links, '   '), links);
});

test('filterLinks matches against the title', () => {
  const result = filterLinks(links, 'Hacker');
  assert.deepEqual(result, [links[2]]);
});

test('filterLinks matches against the url', () => {
  const result = filterLinks(links, 'github.com');
  assert.deepEqual(result, [links[1]]);
});

test('filterLinks is case-insensitive', () => {
  const result = filterLinks(links, 'HACKER news');
  assert.deepEqual(result, [links[2]]);
});

test('filterLinks returns an empty array when nothing matches', () => {
  assert.deepEqual(filterLinks(links, 'no-such-term'), []);
});
