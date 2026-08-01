import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incrementOpenCount, getLeastViewed } from '../src/leastViewed.js';

test('incrementOpenCount starts an unset openCount at 1, without touching other links', () => {
  const links = [
    { id: '1', url: 'https://a.com', title: 'A', savedAt: 't1' },
    { id: '2', url: 'https://b.com', title: 'B', savedAt: 't2', openCount: 3 },
  ];
  const result = incrementOpenCount(links, '1');
  assert.equal(result.find((l) => l.id === '1').openCount, 1);
  assert.equal(result.find((l) => l.id === '2').openCount, 3);
});

test('incrementOpenCount increments an existing count', () => {
  const links = [{ id: '1', url: 'https://a.com', title: 'A', savedAt: 't1', openCount: 3 }];
  const result = incrementOpenCount(links, '1');
  assert.equal(result[0].openCount, 4);
});

test('getLeastViewed sorts by openCount ascending', () => {
  const links = [
    { id: '1', url: 'https://a.com', title: 'A', savedAt: '2026-01-01', openCount: 5 },
    { id: '2', url: 'https://b.com', title: 'B', savedAt: '2026-01-02', openCount: 1 },
    { id: '3', url: 'https://c.com', title: 'C', savedAt: '2026-01-03', openCount: 3 },
  ];
  const result = getLeastViewed(links, 3);
  assert.deepEqual(result.map((l) => l.id), ['2', '3', '1']);
});

test('getLeastViewed breaks ties on openCount by oldest savedAt first', () => {
  const links = [
    { id: '1', url: 'https://a.com', title: 'A', savedAt: '2026-01-03' },
    { id: '2', url: 'https://b.com', title: 'B', savedAt: '2026-01-01' },
    { id: '3', url: 'https://c.com', title: 'C', savedAt: '2026-01-02' },
  ];
  const result = getLeastViewed(links, 3);
  assert.deepEqual(result.map((l) => l.id), ['2', '3', '1']);
});

test('getLeastViewed defaults to the 5 least-viewed links', () => {
  const links = Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    url: `https://${i}.com`,
    title: String(i),
    savedAt: `2026-01-${String(i + 1).padStart(2, '0')}`,
    openCount: i,
  }));
  const result = getLeastViewed(links);
  assert.equal(result.length, 5);
  assert.deepEqual(result.map((l) => l.id), ['0', '1', '2', '3', '4']);
});

test('getLeastViewed does not mutate the input array', () => {
  const links = [
    { id: '1', url: 'https://a.com', title: 'A', savedAt: 't1', openCount: 2 },
    { id: '2', url: 'https://b.com', title: 'B', savedAt: 't2', openCount: 1 },
  ];
  const copy = [...links];
  getLeastViewed(links, 2);
  assert.deepEqual(links, copy);
});
