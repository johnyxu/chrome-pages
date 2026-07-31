import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLinksFile, serializeLinksFile } from '../src/linksFile.js';

test('parseLinksFile parses a well-formed file', () => {
  const text = '{"links":[{"id":"1","url":"https://a.com","title":"A","savedAt":"t1"}]}';
  const result = parseLinksFile(text);
  assert.equal(result.corrupted, false);
  assert.deepEqual(result.links, [{ id: '1', url: 'https://a.com', title: 'A', savedAt: 't1' }]);
});

test('parseLinksFile treats an empty string as an empty, non-corrupted list', () => {
  const result = parseLinksFile('');
  assert.deepEqual(result, { links: [], corrupted: false });
});

test('parseLinksFile flags invalid JSON as corrupted, returning an empty list', () => {
  const result = parseLinksFile('{not valid json');
  assert.deepEqual(result, { links: [], corrupted: true });
});

test('parseLinksFile flags JSON missing a links array as corrupted', () => {
  const result = parseLinksFile('{"foo": "bar"}');
  assert.deepEqual(result, { links: [], corrupted: true });
});

test('serializeLinksFile round-trips through parseLinksFile', () => {
  const links = [{ id: '1', url: 'https://a.com', title: 'A', savedAt: 't1' }];
  const text = serializeLinksFile(links);
  const result = parseLinksFile(text);
  assert.deepEqual(result, { links, corrupted: false });
});
