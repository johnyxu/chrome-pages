import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDateKey, getRecentDayGroups } from '../src/recentDays.js';

test('getDateKey formats a Date as local YYYY-MM-DD', () => {
  assert.equal(getDateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(getDateKey(new Date(2026, 11, 31)), '2026-12-31');
});

test('getRecentDayGroups groups links by local date, most recent date first', () => {
  const links = [
    { id: '1', url: 'https://a.com', title: 'A', savedAt: '2026-08-01T10:00:00Z' },
    { id: '2', url: 'https://b.com', title: 'B', savedAt: '2026-08-01T09:00:00Z' },
    { id: '3', url: 'https://c.com', title: 'C', savedAt: '2026-07-30T09:00:00Z' },
  ];
  const groups = getRecentDayGroups(links, 7);
  assert.deepEqual(
    groups.map((g) => g.date),
    ['2026-08-01', '2026-07-30']
  );
  assert.equal(groups[0].links.length, 2);
  assert.equal(groups[1].links.length, 1);
});

test('getRecentDayGroups skips dates with no links entirely, without padding', () => {
  const links = [
    { id: '1', url: 'https://a.com', title: 'A', savedAt: '2026-08-01T10:00:00Z' },
    { id: '2', url: 'https://b.com', title: 'B', savedAt: '2026-07-15T10:00:00Z' },
    { id: '3', url: 'https://c.com', title: 'C', savedAt: '2026-01-01T10:00:00Z' },
  ];
  const groups = getRecentDayGroups(links, 7);
  assert.deepEqual(
    groups.map((g) => g.date),
    ['2026-08-01', '2026-07-15', '2026-01-01']
  );
});

test('getRecentDayGroups returns at most `count` dates, keeping the most recent', () => {
  const links = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    url: `https://${i}.com`,
    title: String(i),
    savedAt: new Date(2026, 0, i + 1).toISOString(),
  }));
  const groups = getRecentDayGroups(links, 7);
  assert.equal(groups.length, 7);
  assert.deepEqual(
    groups.map((g) => g.date),
    ['2026-01-10', '2026-01-09', '2026-01-08', '2026-01-07', '2026-01-06', '2026-01-05', '2026-01-04']
  );
});

test('getRecentDayGroups returns fewer than `count` groups when fewer distinct dates exist', () => {
  const links = [
    { id: '1', url: 'https://a.com', title: 'A', savedAt: new Date(2026, 0, 3).toISOString() },
    { id: '2', url: 'https://b.com', title: 'B', savedAt: new Date(2026, 0, 2).toISOString() },
    { id: '3', url: 'https://c.com', title: 'C', savedAt: new Date(2026, 0, 1).toISOString() },
  ];
  const groups = getRecentDayGroups(links, 7);
  assert.equal(groups.length, 3);
});

test('getRecentDayGroups does not mutate the input array', () => {
  const links = [
    { id: '1', url: 'https://a.com', title: 'A', savedAt: new Date(2026, 0, 2).toISOString() },
    { id: '2', url: 'https://b.com', title: 'B', savedAt: new Date(2026, 0, 1).toISOString() },
  ];
  const copy = [...links];
  getRecentDayGroups(links, 7);
  assert.deepEqual(links, copy);
});

test('getRecentDayGroups sorts links within a day newest-savedAt-first', () => {
  const links = [
    { id: '1', url: 'https://a.com', title: 'A', savedAt: '2026-08-01T09:00:00Z' },
    { id: '2', url: 'https://b.com', title: 'B', savedAt: '2026-08-01T11:00:00Z' },
    { id: '3', url: 'https://c.com', title: 'C', savedAt: '2026-08-01T10:00:00Z' },
  ];
  const groups = getRecentDayGroups(links, 7);
  assert.deepEqual(groups[0].links.map((l) => l.id), ['2', '3', '1']);
});
