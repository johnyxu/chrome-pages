import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeLinks, removeLink } from '../src/linkMerge.js';

test('mergeLinks adds new entries not already present', () => {
  const existing = [{ id: '1', url: 'https://a.com', title: 'A', savedAt: 't1' }];
  const incoming = [{ id: '2', url: 'https://b.com', title: 'B', savedAt: 't2' }];
  const result = mergeLinks(existing, incoming);
  assert.equal(result.links.length, 2);
  assert.equal(result.addedCount, 1);
  assert.equal(result.skippedCount, 0);
});

test('mergeLinks skips entries whose url already exists, keeping the original', () => {
  const existing = [{ id: '1', url: 'https://a.com', title: 'A', savedAt: 't1' }];
  const incoming = [{ id: '2', url: 'https://a.com', title: 'A updated', savedAt: 't2' }];
  const result = mergeLinks(existing, incoming);
  assert.equal(result.links.length, 1);
  assert.equal(result.links[0].title, 'A');
  assert.equal(result.links[0].savedAt, 't1');
  assert.equal(result.addedCount, 0);
  assert.equal(result.skippedCount, 1);
});

test('mergeLinks dedupes within the same batch of new entries too', () => {
  const existing = [];
  const incoming = [
    { id: '1', url: 'https://a.com', title: 'A', savedAt: 't1' },
    { id: '2', url: 'https://a.com', title: 'A again', savedAt: 't2' },
  ];
  const result = mergeLinks(existing, incoming);
  assert.equal(result.links.length, 1);
  assert.equal(result.addedCount, 1);
  assert.equal(result.skippedCount, 1);
});

test('removeLink filters out the matching id and leaves others untouched', () => {
  const links = [
    { id: '1', url: 'https://a.com', title: 'A', savedAt: 't1' },
    { id: '2', url: 'https://b.com', title: 'B', savedAt: 't2' },
  ];
  const result = removeLink(links, '1');
  assert.deepEqual(result, [{ id: '2', url: 'https://b.com', title: 'B', savedAt: 't2' }]);
});
