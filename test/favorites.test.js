import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFavorites, toggleFavorite, reorderFavorites, sortGroupsByFavorite } from '../src/favorites.js';

const links = [
  { id: '1', url: 'https://a.com', title: 'A', savedAt: 't1' },
  { id: '2', url: 'https://b.com', title: 'B', savedAt: 't2', favorite: true },
  { id: '3', url: 'https://c.com', title: 'C', savedAt: 't3' },
  { id: '4', url: 'https://d.com', title: 'D', savedAt: 't4', favorite: true },
];

test('getFavorites returns only favorited links, preserving order', () => {
  const result = getFavorites(links);
  assert.deepEqual(result.map((l) => l.id), ['2', '4']);
});

test('getFavorites returns an empty array when nothing is favorited', () => {
  assert.deepEqual(getFavorites([{ id: '1', url: 'https://a.com', title: 'A', savedAt: 't1' }]), []);
});

test('toggleFavorite marks a non-favorite link as favorite without touching others', () => {
  const result = toggleFavorite(links, '1');
  assert.equal(result.find((l) => l.id === '1').favorite, true);
  assert.equal(result.find((l) => l.id === '2').favorite, true);
  assert.equal(result.find((l) => l.id === '3').favorite, undefined);
  assert.equal(result.find((l) => l.id === '4').favorite, true);
});

test('toggleFavorite unmarks an already-favorite link', () => {
  const result = toggleFavorite(links, '2');
  assert.equal(result.find((l) => l.id === '2').favorite, false);
});

test('reorderFavorites repositions only the favorited entries, leaving others in place', () => {
  const result = reorderFavorites(links, ['4', '2']);
  assert.deepEqual(result.map((l) => l.id), ['1', '4', '3', '2']);
});

test('reorderFavorites is a no-op when the order is unchanged', () => {
  const result = reorderFavorites(links, ['2', '4']);
  assert.deepEqual(result.map((l) => l.id), ['1', '2', '3', '4']);
});

test('sortGroupsByFavorite moves groups containing a favorite before groups without, preserving order within each partition', () => {
  const groups = [
    { domain: 'alpha.com', links: [{ id: '1', url: 'https://alpha.com', title: 'A', savedAt: 't1' }] },
    { domain: 'beta.com', links: [{ id: '2', url: 'https://beta.com', title: 'B', savedAt: 't2', favorite: true }] },
    { domain: 'gamma.com', links: [{ id: '3', url: 'https://gamma.com', title: 'G', savedAt: 't3' }] },
    { domain: 'delta.com', links: [{ id: '4', url: 'https://delta.com', title: 'D', savedAt: 't4', favorite: true }] },
  ];
  const result = sortGroupsByFavorite(groups);
  assert.deepEqual(
    result.map((g) => g.domain),
    ['beta.com', 'delta.com', 'alpha.com', 'gamma.com']
  );
});

test('sortGroupsByFavorite moves favorited links to the front within a group, preserving relative order otherwise', () => {
  const groups = [
    {
      domain: 'example.com',
      links: [
        { id: '1', url: 'https://example.com/1', title: 'One', savedAt: 't1' },
        { id: '2', url: 'https://example.com/2', title: 'Two', savedAt: 't2', favorite: true },
        { id: '3', url: 'https://example.com/3', title: 'Three', savedAt: 't3' },
        { id: '4', url: 'https://example.com/4', title: 'Four', savedAt: 't4', favorite: true },
      ],
    },
  ];
  const result = sortGroupsByFavorite(groups);
  assert.deepEqual(
    result[0].links.map((l) => l.id),
    ['2', '4', '1', '3']
  );
});

test('sortGroupsByFavorite leaves group order unchanged when no group has a favorite', () => {
  const groups = [
    { domain: 'alpha.com', links: [{ id: '1', url: 'https://alpha.com', title: 'A', savedAt: 't1' }] },
    { domain: 'beta.com', links: [{ id: '2', url: 'https://beta.com', title: 'B', savedAt: 't2' }] },
  ];
  const result = sortGroupsByFavorite(groups);
  assert.deepEqual(
    result.map((g) => g.domain),
    ['alpha.com', 'beta.com']
  );
});
