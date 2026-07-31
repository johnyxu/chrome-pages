import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDomain, groupLinksByDomain } from '../src/groupByDomain.js';

test('getDomain extracts the hostname from a url', () => {
  assert.equal(getDomain('https://github.com/foo/bar'), 'github.com');
});

test('getDomain strips a leading www.', () => {
  assert.equal(getDomain('https://www.example.com/docs'), 'example.com');
});

test('getDomain falls back to the raw string for an unparseable url', () => {
  assert.equal(getDomain('not-a-url'), 'not-a-url');
});

test('groupLinksByDomain groups links with the same domain together, preserving order within a group', () => {
  const links = [
    { id: '1', url: 'https://github.com/a', title: 'A', savedAt: 't1' },
    { id: '2', url: 'https://example.com/x', title: 'X', savedAt: 't2' },
    { id: '3', url: 'https://github.com/b', title: 'B', savedAt: 't3' },
  ];
  const groups = groupLinksByDomain(links);
  assert.deepEqual(
    groups.map((g) => g.domain),
    ['example.com', 'github.com']
  );
  assert.deepEqual(
    groups.find((g) => g.domain === 'github.com').links.map((l) => l.id),
    ['1', '3']
  );
});

test('groupLinksByDomain treats www. and bare domain as the same group', () => {
  const links = [
    { id: '1', url: 'https://www.example.com/a', title: 'A', savedAt: 't1' },
    { id: '2', url: 'https://example.com/b', title: 'B', savedAt: 't2' },
  ];
  const groups = groupLinksByDomain(links);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].domain, 'example.com');
  assert.equal(groups[0].links.length, 2);
});

test('groupLinksByDomain sorts groups alphabetically by domain', () => {
  const links = [
    { id: '1', url: 'https://zeta.com/a', title: 'Z', savedAt: 't1' },
    { id: '2', url: 'https://alpha.com/a', title: 'A', savedAt: 't2' },
  ];
  const groups = groupLinksByDomain(links);
  assert.deepEqual(
    groups.map((g) => g.domain),
    ['alpha.com', 'zeta.com']
  );
});

test('groupLinksByDomain returns an empty array for an empty input', () => {
  assert.deepEqual(groupLinksByDomain([]), []);
});
