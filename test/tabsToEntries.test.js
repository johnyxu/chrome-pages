import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tabsToEntries } from '../src/tabsToEntries.js';

test('tabsToEntries maps tabs to entries using injected id/time generators', () => {
  const tabs = [
    { url: 'https://a.com', title: 'A' },
    { url: 'https://b.com', title: '' },
  ];
  let counter = 0;
  const result = tabsToEntries(tabs, {
    now: () => 'FIXED_TIME',
    idGen: () => `id-${counter++}`,
  });
  assert.deepEqual(result, [
    { id: 'id-0', url: 'https://a.com', title: 'A', savedAt: 'FIXED_TIME' },
    { id: 'id-1', url: 'https://b.com', title: 'https://b.com', savedAt: 'FIXED_TIME' },
  ]);
});

test('tabsToEntries skips tabs without a usable url', () => {
  const tabs = [{ url: '', title: 'Empty' }, { title: 'No url field' }];
  const result = tabsToEntries(tabs, { now: () => 'T', idGen: () => 'id' });
  assert.deepEqual(result, []);
});
