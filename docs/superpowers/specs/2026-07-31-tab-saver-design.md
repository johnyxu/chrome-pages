# Tab Saver Chrome Extension — Design

## Purpose

A Chrome extension (Manifest V3) that lets the user save the URL + title of open
tabs into a single local JSON file, either all open tabs at once or just the
current tab, and browse/remove saved links from a dedicated management page.

## Architecture

Three pieces, no persistent background service worker (nothing needs to run
continuously — everything is triggered by user action from a page context):

- **Popup** (`popup.html` / `popup.js`) — quick actions:
  - "Save All Tabs" — saves every open tab across all windows
  - "Save Current Tab" — saves only the active tab
  - A status line for feedback ("Saved 5 tabs", "Already saved", errors)
  - A link to open the manager page
- **Manager page** (`manager.html` / `manager.js`) — a full extension tab that:
  - Lists all saved links (title, URL, saved date) with a Remove button per row
  - Lets the user connect/reconnect the backing JSON file
- **Shared storage module** (`storage.js`) — wraps:
  - The File System Access API for reading/writing the JSON file
  - IndexedDB, to persist the `FileSystemFileHandle` so both the popup and the
    manager page (same extension origin) can reach the same connected file

## File Connection Flow

1. On first use, no file handle exists yet. The manager page shows a
   "Connect a file" control.
2. Clicking it calls `showSaveFilePicker()` (suggested filename
   `saved-tabs.json`), and the resulting handle is stored in IndexedDB.
3. Chrome extensions retain this permission grant persistently, so the user
   is not re-prompted every session (unlike regular websites).
4. If the popup's save buttons are clicked before a file is connected, they
   are disabled with a message pointing the user to the manager page to
   connect one first.

## Data Format

A single JSON file with this shape:

```json
{
  "links": [
    {
      "id": "uuid",
      "url": "https://example.com",
      "title": "Page Title",
      "savedAt": "2026-07-31T12:00:00Z"
    }
  ]
}
```

## Save Flow

1. Popup reads the stored file handle from IndexedDB.
2. Verifies (or re-requests, if needed) write permission on the handle.
3. Reads and parses the existing JSON file contents.
4. Builds new entries from the requested tab(s) (current tab, or all tabs
   across all open windows for "Save All").
5. Merges new entries into the existing list, **skipping any URL that is
   already present** (duplicates are silently ignored — the original entry
   and its original `savedAt` are kept).
6. Writes the full updated JSON back to the file.
7. Shows a status message in the popup summarizing the result.

## Remove Flow

1. Manager page loads and reads the current file contents into memory.
2. Clicking "Remove" on a row filters that entry out of the in-memory list.
3. The full updated list is written back to the file immediately.

## Error Handling

- **Permission revoked, or file moved/deleted:** a read/write failure surfaces
  an inline error (in the popup or manager page) with a "Reconnect file"
  button that re-opens the file picker.
- **Corrupted/unreadable JSON:** treated as an empty list, with a visible
  warning rather than silently discarding — the extension is the sole writer
  of this file, so this should be rare.

## UI Details

- **Popup:** two buttons ("Save All Tabs", "Save Current Tab"), a status line,
  and a "View saved links" link to the manager page.
- **Manager page:** a simple list — clickable Title (opens the link), URL
  (truncated), Saved date, and a Remove button per row. No search/filtering
  in this version (YAGNI — straightforward to add later if needed).

## Out of Scope (YAGNI)

- Context menu / keyboard shortcut triggers
- Search or filtering on the manager page
- Syncing across devices
- Export formats other than JSON
- Tagging, folders, or categorization of saved links

## Testing

Manual testing by loading the extension unpacked in Chrome
(`chrome://extensions` → Developer mode → Load unpacked):

- Fresh install → connect file → save current tab → verify file contents
- Save all tabs across multiple windows → verify all appear, no duplicates
- Re-save an already-saved URL → verify it's skipped, not duplicated
- Open manager page → remove an entry → verify file is rewritten correctly
- Simulate permission loss (revoke via `chrome://settings` or move the file)
  → verify the "Reconnect file" error path works
