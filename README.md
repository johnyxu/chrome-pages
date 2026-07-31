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

Tab Saver is the sole intended writer of the connected JSON file. If the
connected file is unparseable, or is valid JSON that doesn't match the
expected `{ "links": [...] }` shape (e.g. it points at some other, unrelated
`.json` file), the extension detects this and refuses to write — it will
never merge tabs into it or overwrite it.

## Run the unit tests

```bash
npm test
```

Tests cover the pure logic modules (`src/linkMerge.js`, `src/tabsToEntries.js`,
`src/linksFile.js`). The browser-only `src/storage.js` (File System Access API
+ IndexedDB) is verified manually — see
`docs/superpowers/specs/2026-07-31-tab-saver-design.md` for the manual test
checklist.
