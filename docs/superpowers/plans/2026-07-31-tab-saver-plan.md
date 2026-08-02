# Tab Saver Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension that saves open tabs' URL + title into a single local JSON file (via the File System Access API), with a popup to trigger saves and a manager page to view/remove saved links.

**Architecture:** Pure, unit-testable logic modules (`src/linkMerge.js`, `src/tabsToEntries.js`, `src/linksFile.js`) hold all the decision-making (dedupe, entry-building, (de)serialization). A thin browser-only `src/storage.js` wraps the File System Access API and IndexedDB (for persisting the file handle) and is manually tested since it depends on browser APIs unavailable in Node. `popup.js` and `manager.js` wire these together for the two UI surfaces. No background service worker is used.

**Tech Stack:** Vanilla JS (ES modules), Chrome Manifest V3, File System Access API, IndexedDB, Node's built-in `node:test` runner for unit tests (no external dependencies).

## Global Constraints

- Manifest V3, no persistent background service worker.
- Single JSON file as the source of truth: `{ "links": [{ id, url, title, savedAt }] }`.
- Duplicate URLs are skipped silently on save (original entry and its `savedAt` are kept).
- "Save All Tabs" saves tabs across all open windows, not just the current window.
- File connection uses `showSaveFilePicker()`; the resulting `FileSystemFileHandle` is persisted in IndexedDB so both the popup and manager page (same extension origin) can reach it.
- No search/filtering, no context menu, no keyboard shortcuts, no sync, no export formats other than JSON, no tagging/folders (YAGNI, per spec).
- Manifest requires the `"tabs"` permission (needed to read `url`/`title` of tabs the extension doesn't otherwise have host permission for).
- No npm dependencies; use Node's built-in `node:test` + `node:assert/strict` for unit tests.

---

## Task 1: Extension Scaffold (manifest, package.json, static markup)

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `popup.html`
- Create: `popup.css`
- Create: `manager.html`
- Create: `manager.css`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: static DOM structure later tasks will attach scripts to —
  `popup.html` exposes element ids `save-all-btn`, `save-current-btn`, `status`, `manage-link`.
  `manager.html` exposes element ids `error`, `connect-section`, `connect-btn`, `list-section`, `reconnect-btn`, `link-list`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tab-saver",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/"
  }
}
```

- [ ] **Step 2: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Tab Saver",
  "version": "1.0.0",
  "description": "Save open tab URLs and titles to a local JSON file.",
  "permissions": ["tabs"],
  "action": {
    "default_popup": "popup.html"
  }
}
```

- [ ] **Step 3: Create `popup.html`**

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Tab Saver</title>
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <div class="popup">
    <button id="save-all-btn">Save All Tabs</button>
    <button id="save-current-btn">Save Current Tab</button>
    <p id="status"></p>
    <a href="#" id="manage-link">View saved links</a>
  </div>
</body>
</html>
```

- [ ] **Step 4: Create `popup.css`**

```css
body { font-family: system-ui, sans-serif; margin: 0; }
.popup { width: 220px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
button { padding: 6px 10px; cursor: pointer; }
#status { font-size: 12px; color: #444; min-height: 1.2em; margin: 0; }
```

- [ ] **Step 5: Create `manager.html`**

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Tab Saver — Saved Links</title>
  <link rel="stylesheet" href="manager.css" />
</head>
<body>
  <h1>Saved Links</h1>
  <div id="error" hidden></div>
  <div id="connect-section">
    <p>No file connected yet.</p>
    <button id="connect-btn">Connect a file</button>
  </div>
  <div id="list-section" hidden>
    <button id="reconnect-btn">Connect a different file</button>
    <ul id="link-list"></ul>
  </div>
</body>
</html>
```

- [ ] **Step 6: Create `manager.css`**

```css
body { font-family: system-ui, sans-serif; max-width: 720px; margin: 24px auto; padding: 0 16px; }
#error { background: #fee; border: 1px solid #f99; padding: 8px 12px; margin-bottom: 12px; }
#link-list { list-style: none; padding: 0; }
#link-list li { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #eee; }
#link-list li a { flex: 1; }
#link-list li .url { flex: 2; color: #666; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

- [ ] **Step 7: Manual test — load unpacked extension**

In Chrome: go to `chrome://extensions`, enable Developer mode, click "Load unpacked", select the project folder.

Expected: extension card appears with no errors. Clicking the toolbar icon shows the popup with two buttons and a "View saved links" link (buttons are inert — no JS wired yet, that's expected). Navigating to `chrome-extension://<extension-id>/manager.html` shows the static "No file connected yet." state.

- [ ] **Step 8: Commit**

```bash
git add manifest.json package.json popup.html popup.css manager.html manager.css
git commit -m "chore: scaffold extension manifest and static UI markup"
```

---

## Task 2: Pure Link-Merge Logic

**Files:**
- Create: `src/linkMerge.js`
- Test: `test/linkMerge.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `mergeLinks(existingLinks: Array<{id,url,title,savedAt}>, newEntries: Array<{id,url,title,savedAt}>): { links: Array, addedCount: number, skippedCount: number }`
  - `removeLink(links: Array<{id,url,title,savedAt}>, id: string): Array`

- [ ] **Step 1: Write the failing tests**

Create `test/linkMerge.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/linkMerge.test.js`
Expected: FAIL — `Cannot find module '../src/linkMerge.js'`

- [ ] **Step 3: Implement `src/linkMerge.js`**

```js
export function mergeLinks(existingLinks, newEntries) {
  const seenUrls = new Set(existingLinks.map((link) => link.url));
  const added = [];
  for (const entry of newEntries) {
    if (seenUrls.has(entry.url)) continue;
    seenUrls.add(entry.url);
    added.push(entry);
  }
  return {
    links: [...existingLinks, ...added],
    addedCount: added.length,
    skippedCount: newEntries.length - added.length,
  };
}

export function removeLink(links, id) {
  return links.filter((link) => link.id !== id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/linkMerge.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/linkMerge.js test/linkMerge.test.js
git commit -m "feat: add pure link-merge and remove logic with tests"
```

---

## Task 3: Tab-to-Entry Mapping and Links-File (De)serialization

**Files:**
- Create: `src/tabsToEntries.js`
- Create: `src/linksFile.js`
- Test: `test/tabsToEntries.test.js`
- Test: `test/linksFile.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `tabsToEntries(tabs: Array<{url?: string, title?: string}>, deps?: { now?: () => string, idGen?: () => string }): Array<{id, url, title, savedAt}>`
  - `parseLinksFile(text: string): { links: Array, corrupted: boolean }`
  - `serializeLinksFile(links: Array): string`

- [ ] **Step 1: Write the failing tests for `tabsToEntries`**

Create `test/tabsToEntries.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/tabsToEntries.test.js`
Expected: FAIL — `Cannot find module '../src/tabsToEntries.js'`

- [ ] **Step 3: Implement `src/tabsToEntries.js`**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/tabsToEntries.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing tests for `linksFile`**

Create `test/linksFile.test.js`:

```js
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
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `node --test test/linksFile.test.js`
Expected: FAIL — `Cannot find module '../src/linksFile.js'`

- [ ] **Step 7: Implement `src/linksFile.js`**

```js
export function parseLinksFile(text) {
  if (!text || text.trim() === '') {
    return { links: [], corrupted: false };
  }
  try {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.links)) {
      return { links: [], corrupted: true };
    }
    return { links: data.links, corrupted: false };
  } catch {
    return { links: [], corrupted: true };
  }
}

export function serializeLinksFile(links) {
  return JSON.stringify({ links }, null, 2);
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `node --test test/linksFile.test.js`
Expected: PASS (5 tests)

- [ ] **Step 9: Run the full test suite**

Run: `npm test`
Expected: PASS (11 tests total across all three test files)

- [ ] **Step 10: Commit**

```bash
git add src/tabsToEntries.js src/linksFile.js test/tabsToEntries.test.js test/linksFile.test.js
git commit -m "feat: add tab-to-entry mapping and links-file (de)serialization with tests"
```

---

## Task 4: Storage Module and Manager Page Wiring

**Files:**
- Create: `src/storage.js`
- Create: `manager.js`
- Modify: `manager.html:16` (add `<script type="module" src="manager.js"></script>` before `</body>`)

**Interfaces:**
- Consumes:
  - `parseLinksFile(text)`, `serializeLinksFile(links)` from `src/linksFile.js` (Task 3)
  - `removeLink(links, id)` from `src/linkMerge.js` (Task 2)
- Produces (used by Task 5's `popup.js`):
  - `connectFile(): Promise<FileSystemFileHandle>`
  - `getConnectedFile(): Promise<FileSystemFileHandle | null>`
  - `readLinksFile(handle): Promise<{ links: Array, corrupted: boolean }>`
  - `writeLinksFile(handle, links: Array): Promise<void>`

This task is browser-API-only (IndexedDB, File System Access API) so it has no automated unit tests — it's verified manually via the manager page, per the design spec's testing approach.

- [ ] **Step 1: Implement `src/storage.js`**

```js
import { parseLinksFile, serializeLinksFile } from './linksFile.js';

const DB_NAME = 'tab-saver';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'linksFile';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function setStoredHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function verifyPermission(handle, mode = 'readwrite') {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

export async function connectFile() {
  const handle = await window.showSaveFilePicker({
    suggestedName: 'saved-tabs.json',
    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
  });
  await setStoredHandle(handle);
  return handle;
}

export async function getConnectedFile() {
  const handle = await getStoredHandle();
  if (!handle) return null;
  const ok = await verifyPermission(handle, 'readwrite');
  return ok ? handle : null;
}

export async function readLinksFile(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  return parseLinksFile(text);
}

export async function writeLinksFile(handle, links) {
  const writable = await handle.createWritable();
  await writable.write(serializeLinksFile(links));
  await writable.close();
}
```

- [ ] **Step 2: Implement `manager.js`**

```js
import { getConnectedFile, connectFile, readLinksFile, writeLinksFile } from './src/storage.js';
import { removeLink } from './src/linkMerge.js';

const connectSection = document.getElementById('connect-section');
const listSection = document.getElementById('list-section');
const linkList = document.getElementById('link-list');
const connectBtn = document.getElementById('connect-btn');
const reconnectBtn = document.getElementById('reconnect-btn');
const errorEl = document.getElementById('error');

let currentHandle = null;
let currentLinks = [];

function showConnect() {
  connectSection.hidden = false;
  listSection.hidden = true;
}

function showList() {
  connectSection.hidden = true;
  listSection.hidden = false;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

function render() {
  linkList.innerHTML = '';
  for (const link of currentLinks) {
    const li = document.createElement('li');

    const a = document.createElement('a');
    a.href = link.url;
    a.textContent = link.title;
    a.target = '_blank';

    const urlSpan = document.createElement('span');
    urlSpan.className = 'url';
    urlSpan.textContent = link.url;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => onRemove(link.id));

    li.append(a, urlSpan, removeBtn);
    linkList.append(li);
  }
}

async function loadAndRender() {
  try {
    const { links, corrupted } = await readLinksFile(currentHandle);
    currentLinks = links;
    if (corrupted) {
      showError('Saved file was unreadable — starting from an empty list.');
    } else {
      clearError();
    }
    render();
    showList();
  } catch (err) {
    showError('Could not read the connected file. Please reconnect.');
    showConnect();
  }
}

async function onRemove(id) {
  currentLinks = removeLink(currentLinks, id);
  await writeLinksFile(currentHandle, currentLinks);
  render();
}

async function onConnectClick() {
  try {
    currentHandle = await connectFile();
    await loadAndRender();
  } catch (err) {
    if (err.name !== 'AbortError') {
      showError('Could not connect the file. Please try again.');
    }
  }
}

connectBtn.addEventListener('click', onConnectClick);
reconnectBtn.addEventListener('click', onConnectClick);

async function init() {
  currentHandle = await getConnectedFile();
  if (!currentHandle) {
    showConnect();
    return;
  }
  await loadAndRender();
}

init();
```

- [ ] **Step 3: Wire the script into `manager.html`**

Modify `manager.html`, adding this line right before `</body>`:

```html
  <script type="module" src="manager.js"></script>
```

- [ ] **Step 4: Manual test — connect, view, and remove**

1. Reload the extension in `chrome://extensions` (click the reload icon on the Tab Saver card).
2. Open `chrome-extension://<extension-id>/manager.html`.
3. Click "Connect a file", and in the save dialog create a new file `saved-tabs.json` in a folder of your choice.
4. Expected: the "No file connected yet" section disappears and an empty list appears (no errors shown).
5. In a text editor, open `saved-tabs.json` and replace its contents with:
   ```json
   {"links":[{"id":"1","url":"https://example.com","title":"Example","savedAt":"2026-07-31T00:00:00Z"}]}
   ```
   Save the file.
6. Reload the manager page. Expected: one row appears — "Example" linking to `https://example.com`, with a Remove button.
7. Click "Remove". Expected: the row disappears immediately.
8. Reopen `saved-tabs.json` in the text editor. Expected: `{"links":[]}` (formatted with 2-space indentation).

- [ ] **Step 5: Commit**

```bash
git add src/storage.js manager.js manager.html
git commit -m "feat: wire manager page to file-backed storage (connect, view, remove)"
```

---

## Task 5: Popup Save Actions

**Files:**
- Create: `popup.js`
- Modify: `popup.html:12` (add `<script type="module" src="popup.js"></script>` before `</body>`)

**Interfaces:**
- Consumes:
  - `getConnectedFile()`, `readLinksFile(handle)`, `writeLinksFile(handle, links)` from `src/storage.js` (Task 4)
  - `mergeLinks(existingLinks, newEntries)` from `src/linkMerge.js` (Task 2)
  - `tabsToEntries(tabs)` from `src/tabsToEntries.js` (Task 3)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Implement `popup.js`**

```js
import { getConnectedFile, readLinksFile, writeLinksFile } from './src/storage.js';
import { mergeLinks } from './src/linkMerge.js';
import { tabsToEntries } from './src/tabsToEntries.js';

const saveAllBtn = document.getElementById('save-all-btn');
const saveCurrentBtn = document.getElementById('save-current-btn');
const statusEl = document.getElementById('status');
const manageLink = document.getElementById('manage-link');

const NO_FILE_MESSAGE = 'No file connected. Open "View saved links" to connect one.';

async function saveTabs(tabs) {
  const handle = await getConnectedFile();
  if (!handle) {
    statusEl.textContent = NO_FILE_MESSAGE;
    return;
  }
  try {
    const { links: existingLinks } = await readLinksFile(handle);
    const entries = tabsToEntries(tabs);
    const { links, addedCount, skippedCount } = mergeLinks(existingLinks, entries);
    await writeLinksFile(handle, links);
    statusEl.textContent = `Saved ${addedCount} tab(s), skipped ${skippedCount} already-saved.`;
  } catch (err) {
    statusEl.textContent = 'Could not save — the connected file may be missing. Reconnect it from "View saved links".';
  }
}

saveAllBtn.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({});
  await saveTabs(tabs);
});

saveCurrentBtn.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  await saveTabs(tabs);
});

manageLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('manager.html') });
});

async function init() {
  const handle = await getConnectedFile();
  if (!handle) {
    saveAllBtn.disabled = true;
    saveCurrentBtn.disabled = true;
    statusEl.textContent = NO_FILE_MESSAGE;
  }
}

init();
```

- [ ] **Step 2: Wire the script into `popup.html`**

Modify `popup.html`, adding this line right before `</body>`:

```html
  <script type="module" src="popup.js"></script>
```

- [ ] **Step 3: Manual test — save current tab**

1. Reload the extension in `chrome://extensions`.
2. Make sure a file is connected (from Task 4's manual test), and its content is `{"links":[]}`.
3. Navigate to any page (e.g. `https://example.com`), open the popup, click "Save Current Tab".
4. Expected: status text reads "Saved 1 tab(s), skipped 0 already-saved."
5. Open the manager page (or reload it). Expected: the tab's title and URL appear in the list.

- [ ] **Step 4: Manual test — save all tabs and duplicate skipping**

1. Open 2-3 more tabs on different pages, keeping the one from Step 3 open too.
2. Open the popup, click "Save All Tabs".
3. Expected: status shows N tabs saved and 1 skipped (the already-saved one from Step 3).
4. Click "Save All Tabs" again immediately.
5. Expected: status shows 0 saved, all skipped.
6. Open the manager page. Expected: no duplicate rows for any URL.

- [ ] **Step 5: Manual test — no file connected state**

1. In the manager page, note there's currently no "disconnect" affordance — to test this state, temporarily test on a fresh profile/second extension load, OR verify by inspecting `init()`'s behavior via the following: open `chrome://extensions`, remove and reload the extension unpacked (this clears IndexedDB for the extension), then open the popup.
2. Expected: both buttons are disabled, status reads the "No file connected" message.

- [ ] **Step 6: Commit**

```bash
git add popup.js popup.html
git commit -m "feat: wire popup save-all and save-current actions"
```

---

## Task 6: Reconnect Flow, Error Handling Verification, and README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: the full app built in Tasks 1-5
- Produces: nothing (final task)

- [ ] **Step 1: Manual test — reconnect after the file is moved/deleted**

1. With a file connected and some links saved, quit Chrome or just proceed directly (no restart needed).
2. In Finder/Explorer, rename or delete the connected `saved-tabs.json` file.
3. Open the popup and click "Save Current Tab".
4. Expected: status shows "Could not save — the connected file may be missing. Reconnect it from 'View saved links'."
5. Open the manager page.
6. Expected: the error banner reads "Could not read the connected file. Please reconnect." and the "Connect a file" section is shown.
7. Click "Connect a file" and create a new `saved-tabs.json`.
8. Expected: connection succeeds, an empty list is shown, and saving from the popup works again.

- [ ] **Step 2: Manual test — reconnect to a different existing file**

1. With a file already connected and working, open the manager page.
2. Click "Connect a different file" and pick/create a different `.json` file.
3. Expected: the manager page now reads from the newly selected file (starts empty if it's new, or shows its existing `links` if it already had valid content).
4. Open the popup and save the current tab.
5. Expected: the new file (not the old one) is updated — verify by opening both files in a text editor.

- [ ] **Step 3: Write `README.md`**

```markdown
# Tab Saver

A Chrome extension that saves open tabs' URL and title into a single local
JSON file, and lets you browse or remove saved links from a manager page.

## Load the extension

1. Open `chrome://extensions`.
2. Enable "Developer mode" (top-right toggle).
3. Click "Load unpacked" and select this project's folder.

## Usage

1. Click the Tab Saver toolbar icon.
2. The first time, click "View saved links" and then "Connect a file" to
   create or choose the JSON file that will store your saved links.
3. From the popup, click "Save All Tabs" to save every open tab across all
   windows, or "Save Current Tab" to save just the active tab. Tabs whose
   URL is already saved are skipped.
4. Click "View saved links" to open the manager page, where each saved link
   can be opened or removed. Use "Connect a different file" to switch which
   file the extension reads from and writes to.

## Run the unit tests

```bash
npm test
```

Tests cover the pure logic modules (`src/linkMerge.js`, `src/tabsToEntries.js`,
`src/linksFile.js`). The browser-only `src/storage.js` (File System Access API
+ IndexedDB) is verified manually — see
`docs/superpowers/specs/2026-07-31-tab-saver-design.md` for the manual test
checklist.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with load-unpacked and usage instructions"
```
