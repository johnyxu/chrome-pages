# Recent 7 Days Sidebar Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Recent 7 Days" box to the manager page's left sidebar (below Favorites) that lists the most recent dates with saved tabs, and lets clicking a date filter the main list down to just that day's tabs.

**Architecture:** A new pure-logic module (`src/recentDays.js`) groups links by local calendar date and returns the most recent dates that actually have links. `manager.html`/`manager.css` gain a second sidebar box stacked under Favorites inside a shared flex-column wrapper. `manager.js` wires up rendering the date buttons and an ephemeral `selectedDate` filter state that, when set, overrides the normal list/card/least-viewed rendering with a flat, date-filtered list (mirroring how the existing Least Viewed mode already overrides normal rendering).

**Tech Stack:** Vanilla JS (ES modules), no build step, `node --test` for unit tests.

## Global Constraints

- Any functional change must update, in this same change: `README.md`, `docs/zh/README.md`, `docs/user-guide.md`, `docs/zh/user-guide.md` (from project `CLAUDE.md`).
- Any change visible in the manager page UI must add/update matching SVG mockups in `docs/images/en/` and `docs/images/zh/` (from project `CLAUDE.md`).
- Both language doc versions are kept in parallel — never update only one; keep each file's `**Language:**` cross-link line intact (from project `CLAUDE.md`).
- The number of recent days shown is hardcoded at 7, not configurable (from design spec `docs/superpowers/specs/2026-08-02-recent-days-filter-design.md`).
- The date filter (`selectedDate`) is ephemeral — never persisted via `setViewMode`/storage, unlike `viewMode` (from design spec).

---

### Task 1: `src/recentDays.js` grouping logic

**Files:**
- Create: `src/recentDays.js`
- Test: `test/recentDays.test.js`

**Interfaces:**
- Consumes: nothing new — operates on the existing link shape `{ id, url, title, savedAt, ... }` already used throughout `src/*.js`.
- Produces:
  - `getDateKey(date: Date): string` — returns a local `YYYY-MM-DD` string for a `Date` instance. Used later by `manager.js` for "Today"/"Yesterday" labeling and for the stale-filter check.
  - `getRecentDayGroups(links: Array, count = 7): Array<{ date: string, links: Array }>` — the top `count` distinct local dates (most recent first) that have at least one link, each with its links sorted newest-`savedAt`-first. Used later by `manager.js` to render the sidebar buttons.

- [ ] **Step 1: Write the failing tests**

Create `test/recentDays.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/recentDays.js` does not exist yet (module not found error).

- [ ] **Step 3: Implement `src/recentDays.js`**

```js
export function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRecentDayGroups(links, count = 7) {
  const byDate = new Map();
  for (const link of links) {
    const key = getDateKey(new Date(link.savedAt));
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(link);
  }
  return [...byDate.keys()]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, count)
    .map((date) => ({
      date,
      links: byDate.get(date).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)),
    }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 7 new tests green, plus every pre-existing test still passing.

- [ ] **Step 5: Commit**

```bash
git add src/recentDays.js test/recentDays.test.js
git commit -m "feat: add recentDays module for grouping links by recent save date"
```

---

### Task 2: Sidebar layout — HTML structure and CSS

**Files:**
- Modify: `manager.html:9-13`
- Modify: `manager.css:56-84` (`.favorites-sidebar`, `.favorites-title` rules), `manager.css:159-169` (the `@media (max-width: 700px)` block)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: DOM elements `#recent-days-sidebar` (an `<aside>`, `hidden` by default) and `#recent-days-list` (its content container), which Task 3's `manager.js` will look up by ID and populate. CSS classes `.sidebar-column`, `.sidebar-box`, `.sidebar-box-title` (shared by both sidebar boxes), and `.recent-days-list` / `.recent-day-btn` / `.recent-day-label` / `.recent-day-count` / `.recent-days-empty` (new, for Task 3's rendering).

This task only changes markup/styles — the new box stays empty and `hidden`, so there is no behavior change yet and the existing test suite and page are unaffected.

- [ ] **Step 1: Update `manager.html`**

Replace:

```html
    <aside id="favorites-sidebar" class="favorites-sidebar" hidden>
      <h2 class="favorites-title">★ Favorites</h2>
      <div id="favorites-list" class="favorites-list"></div>
    </aside>
```

with:

```html
    <div class="sidebar-column">
      <aside id="favorites-sidebar" class="sidebar-box favorites-sidebar" hidden>
        <h2 class="sidebar-box-title">★ Favorites</h2>
        <div id="favorites-list" class="favorites-list"></div>
      </aside>
      <aside id="recent-days-sidebar" class="sidebar-box recent-days-sidebar" hidden>
        <h2 class="sidebar-box-title">🕓 Recent 7 Days</h2>
        <div id="recent-days-list" class="recent-days-list"></div>
      </aside>
    </div>
```

- [ ] **Step 2: Update `manager.css` — replace the sidebar box rules**

Replace:

```css
.favorites-sidebar {
  width: 220px;
  flex-shrink: 0;
  position: sticky;
  top: 32px;
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
}

.favorites-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
}
```

with:

```css
.sidebar-column {
  width: 220px;
  flex-shrink: 0;
  position: sticky;
  top: 32px;
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sidebar-box {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
}

.sidebar-box-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
}

.recent-days-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.recent-days-empty {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.recent-day-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
  text-align: left;
}

.recent-day-btn:hover {
  border-color: var(--accent);
}

.recent-day-btn[aria-pressed="true"] {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-fg);
}

.recent-day-count {
  flex-shrink: 0;
  font-weight: 400;
  color: var(--muted);
}

.recent-day-btn[aria-pressed="true"] .recent-day-count {
  color: var(--accent-fg);
  opacity: 0.85;
}
```

- [ ] **Step 3: Update the `@media (max-width: 700px)` block in `manager.css`**

Replace:

```css
@media (max-width: 700px) {
  .page-layout {
    flex-direction: column;
  }

  .favorites-sidebar {
    width: 100%;
    position: static;
    max-height: none;
  }
}
```

with:

```css
@media (max-width: 700px) {
  .page-layout {
    flex-direction: column;
  }

  .sidebar-column {
    width: 100%;
    position: static;
    max-height: none;
  }
}
```

- [ ] **Step 4: Run the unit tests to confirm no regression**

Run: `npm test`
Expected: PASS — this task touches no JS logic, so every test from Task 1 and earlier still passes unchanged.

- [ ] **Step 5: Commit**

```bash
git add manager.html manager.css
git commit -m "feat: add Recent 7 Days sidebar box markup and styles"
```

---

### Task 3: Wire up `manager.js` — render and filter behavior

**Files:**
- Modify: `manager.js`

**Interfaces:**
- Consumes:
  - `getDateKey(date: Date): string` and `getRecentDayGroups(links, count = 7)` from `src/recentDays.js` (Task 1).
  - `#recent-days-sidebar` / `#recent-days-list` from `manager.html` (Task 2).
- Produces: no new exports (this is the top-level page script) — but introduces the `selectedDate` state and the `renderRecentDays()` / `renderDateFiltered()` functions referenced in this task's own steps.

This task has no automated tests (consistent with the rest of `manager.js`, which is DOM-driven browser code verified manually — see the existing `docs/superpowers/specs/2026-07-31-tab-saver-design.md` manual test checklist). Verification is manual, in Step 8.

- [ ] **Step 1: Add the import and DOM references**

At the top of `manager.js`, add to the existing import block:

```js
import { getDateKey, getRecentDayGroups } from './src/recentDays.js';
```

Add after the existing `const favoritesList = ...` line:

```js
const recentDaysSidebar = document.getElementById('recent-days-sidebar');
const recentDaysList = document.getElementById('recent-days-list');
```

Add after the existing `let viewMode = 'list';` line:

```js
let selectedDate = null;
```

- [ ] **Step 2: Show/hide the new sidebar box alongside Favorites**

In `showConnect()`, add a line next to the existing `favoritesSidebar.hidden = true;`:

```js
function showConnect() {
  connectSection.hidden = false;
  listSection.hidden = true;
  reconnectBtn.hidden = true;
  favoritesSidebar.hidden = true;
  recentDaysSidebar.hidden = true;
  linkCountEl.textContent = '';
}
```

In `showList()`, add a line next to the existing `favoritesSidebar.hidden = false;`:

```js
function showList() {
  connectSection.hidden = true;
  listSection.hidden = false;
  reconnectBtn.hidden = false;
  favoritesSidebar.hidden = false;
  recentDaysSidebar.hidden = false;
}
```

- [ ] **Step 3: Add the day-label formatter**

Add this function near `renderFavorites()`:

```js
function formatDayLabel(dateKey) {
  const todayKey = getDateKey(new Date());
  if (dateKey === todayKey) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === getDateKey(yesterday)) return 'Yesterday';

  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}
```

- [ ] **Step 4: Add the Recent Days rendering functions**

Add these functions near `renderFavorites()`:

```js
function renderRecentDayButton(group) {
  const btn = document.createElement('button');
  btn.className = 'recent-day-btn';
  btn.type = 'button';
  btn.setAttribute('aria-pressed', String(group.date === selectedDate));

  const label = document.createElement('span');
  label.className = 'recent-day-label';
  label.textContent = formatDayLabel(group.date);

  const count = document.createElement('span');
  count.className = 'recent-day-count';
  count.textContent = String(group.links.length);

  btn.append(label, count);
  btn.addEventListener('click', () => onSelectDate(group.date));
  return btn;
}

function renderRecentDays() {
  recentDaysList.innerHTML = '';
  const groups = getRecentDayGroups(currentLinks, 7);
  if (groups.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'recent-days-empty';
    empty.textContent = 'No recent tabs yet.';
    recentDaysList.append(empty);
    return;
  }
  for (const group of groups) {
    recentDaysList.append(renderRecentDayButton(group));
  }
}

function onSelectDate(date) {
  selectedDate = selectedDate === date ? null : date;
  render();
}

function renderDateFiltered(date) {
  searchInput.hidden = true;
  const dayLinks = currentLinks
    .filter((link) => getDateKey(new Date(link.savedAt)) === date)
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  linkCountEl.textContent = `${dayLinks.length} tab${dayLinks.length === 1 ? '' : 's'} from ${formatDayLabel(date)}`;

  if (dayLinks.length === 0) {
    renderEmptyMessage('No saved links for this day.');
    return;
  }

  const container = document.createElement('ul');
  container.className = 'link-list';
  for (const link of dayLinks) {
    container.append(renderLinkItem(link));
  }
  linkList.append(container);
}
```

- [ ] **Step 5: Wire the new rendering into `render()`**

Replace the existing `render()` function:

```js
function render() {
  linkList.innerHTML = '';
  renderFavorites();

  if (currentLinks.length === 0) {
    linkCountEl.textContent = '';
    searchInput.hidden = false;
    renderEmptyMessage('No links saved yet — use the popup to save your first tab.');
    return;
  }

  if (viewMode === 'least-viewed') {
    renderLeastViewed();
    return;
  }
  searchInput.hidden = false;

  const visibleLinks = filterLinks(currentLinks, searchQuery);

  linkCountEl.textContent =
    searchQuery.trim() === ''
      ? `${currentLinks.length} saved link${currentLinks.length === 1 ? '' : 's'}`
      : `${visibleLinks.length} of ${currentLinks.length} saved link${currentLinks.length === 1 ? '' : 's'}`;

  if (visibleLinks.length === 0) {
    renderEmptyMessage('No saved links match your search.');
    return;
  }

  for (const group of sortGroupsByFavorite(groupLinksByDomain(visibleLinks))) {
    const section = document.createElement('section');
    section.className = 'link-group';

    const header = document.createElement('h2');
    header.className = 'group-header';
    header.textContent = group.domain;
    const countSpan = document.createElement('span');
    countSpan.className = 'group-count';
    countSpan.textContent = ` (${group.links.length})`;
    header.append(countSpan);

    const container = document.createElement(viewMode === 'card' ? 'div' : 'ul');
    container.className = viewMode === 'card' ? 'link-cards' : 'link-list';
    for (const link of group.links) {
      container.append(viewMode === 'card' ? renderLinkCard(link) : renderLinkItem(link));
    }

    section.append(header, container);
    linkList.append(section);
  }
}
```

with:

```js
function render() {
  linkList.innerHTML = '';
  renderFavorites();

  if (currentLinks.length === 0) {
    selectedDate = null;
    renderRecentDays();
    linkCountEl.textContent = '';
    searchInput.hidden = false;
    renderEmptyMessage('No links saved yet — use the popup to save your first tab.');
    return;
  }

  if (selectedDate && !currentLinks.some((link) => getDateKey(new Date(link.savedAt)) === selectedDate)) {
    selectedDate = null;
  }
  renderRecentDays();

  if (selectedDate) {
    renderDateFiltered(selectedDate);
    return;
  }

  if (viewMode === 'least-viewed') {
    renderLeastViewed();
    return;
  }
  searchInput.hidden = false;

  const visibleLinks = filterLinks(currentLinks, searchQuery);

  linkCountEl.textContent =
    searchQuery.trim() === ''
      ? `${currentLinks.length} saved link${currentLinks.length === 1 ? '' : 's'}`
      : `${visibleLinks.length} of ${currentLinks.length} saved link${currentLinks.length === 1 ? '' : 's'}`;

  if (visibleLinks.length === 0) {
    renderEmptyMessage('No saved links match your search.');
    return;
  }

  for (const group of sortGroupsByFavorite(groupLinksByDomain(visibleLinks))) {
    const section = document.createElement('section');
    section.className = 'link-group';

    const header = document.createElement('h2');
    header.className = 'group-header';
    header.textContent = group.domain;
    const countSpan = document.createElement('span');
    countSpan.className = 'group-count';
    countSpan.textContent = ` (${group.links.length})`;
    header.append(countSpan);

    const container = document.createElement(viewMode === 'card' ? 'div' : 'ul');
    container.className = viewMode === 'card' ? 'link-cards' : 'link-list';
    for (const link of group.links) {
      container.append(viewMode === 'card' ? renderLinkCard(link) : renderLinkItem(link));
    }

    section.append(header, container);
    linkList.append(section);
  }
}
```

(The only changes: clearing `selectedDate` and calling `renderRecentDays()` in the empty-state branch; the stale-date check plus `renderRecentDays()` call right after; and the new `if (selectedDate) { renderDateFiltered(selectedDate); return; }` branch before the existing `viewMode === 'least-viewed'` check.)

- [ ] **Step 6: Clear the date filter when switching List/Cards/Least Viewed**

Replace:

```js
function onViewModeClick(mode) {
  if (mode === viewMode) return;
  applyViewMode(mode);
  render();
  setViewMode(mode).catch((err) => logUnexpected('saving view mode', err));
}
```

with:

```js
function onViewModeClick(mode) {
  if (mode === viewMode && selectedDate === null) return;
  selectedDate = null;
  applyViewMode(mode);
  render();
  setViewMode(mode).catch((err) => logUnexpected('saving view mode', err));
}
```

- [ ] **Step 7: Run the unit tests to confirm no regression**

Run: `npm test`
Expected: PASS — `manager.js` has no automated tests (browser-only DOM code, same as the rest of the file), so this step just confirms the change didn't break any pure-logic module's tests.

- [ ] **Step 8: Manual verification in the browser**

Load the unpacked extension (`chrome://extensions` → Developer mode → Load unpacked → this project folder; if already loaded, click the reload icon on the extension card), open the manager page, and check:

1. With some saved links spanning several different days: the "🕓 Recent 7 Days" box appears below Favorites, showing up to 7 dates (nearest first, "Today"/"Yesterday" labeled), each with a tab count.
2. Save/remove tabs across several different calendar days (or edit `saved-tabs.json`'s `savedAt` values directly for testing) so that some days have zero tabs — confirm those days are skipped and farther-back dates fill in to keep 7 entries.
3. Click a date: the main list becomes a flat list of just that day's tabs, the search box hides, and the clicked button is visually highlighted (`aria-pressed="true"`).
4. Click the same date again: filter clears, normal grouped/searchable view returns.
5. With a date selected, click "☰ List", "▦ Cards", or "🕓 Least Viewed": the date filter clears and the clicked view renders normally.
6. With a date selected, remove the last tab for that date: the filter automatically clears and the recent-days list updates.
7. With zero saved links: the Recent Days box shows "No recent tabs yet." instead of being empty.

- [ ] **Step 9: Commit**

```bash
git add manager.js
git commit -m "feat: render Recent 7 Days sidebar and wire up date filtering"
```

---

### Task 4: Documentation and mockups

**Files:**
- Modify: `README.md`
- Modify: `docs/zh/README.md`
- Modify: `docs/user-guide.md`
- Modify: `docs/zh/user-guide.md`
- Create: `docs/images/en/manager-recent-days.svg`
- Create: `docs/images/zh/manager-recent-days.svg`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by later tasks (this is the last task).

- [ ] **Step 1: Update `README.md`**

In the "Managing saved links" bullet list, add a new bullet right after the **Favorite** bullet (before **Least Viewed**):

```markdown
- **Recent 7 Days** (left sidebar, below Favorites) — lists the most recent
  dates that have saved tabs (skipping any day with none, reaching further
  back as needed to show up to 7 dates), nearest first. Click a date to
  filter the main list down to just that day's tabs; click it again to
  clear the filter.
```

- [ ] **Step 2: Update `docs/zh/README.md`**

In the "管理已保存的链接" bullet list, add a new bullet right after the 收藏 (Favorite) bullet (before 最少查看):

```markdown
- **最近 7 天**（左侧边栏，收藏下方）——列出最近有保存过标签页的日期（没有标
  签页的那天会被跳过，并往更早的日期找，凑够最多 7 个日期），离今天近的排在
  上面。点击某个日期，可以把主列表筛选为只显示那一天保存的标签页；再次点击
  同一个日期可以取消筛选。
```

- [ ] **Step 3: Update `docs/user-guide.md`**

In the "What this extension does for you" bullet list, add a bullet right after the Favorite bullet:

```markdown
  - Jump straight to a recent day's tabs via the **Recent 7 Days** sidebar
    list;
```

Add `Recent 7 Days sidebar` to the Table of Contents, as a new sub-item right after "Favorites and drag-to-reorder":

```markdown
    - [Recent 7 Days sidebar](#recent-7-days-sidebar)
```

Add a new section right after "### Favorites and drag-to-reorder" and before "### Least Viewed view":

```markdown
### Recent 7 Days sidebar

Below the Favorites sidebar, the **"🕓 Recent 7 Days"** box lists the most
recent dates on which you saved at least one tab:

![Recent 7 Days sidebar](images/en/manager-recent-days.svg)

- Each row shows a date ("Today", "Yesterday", or the full date) and how
  many tabs were saved that day.
- Days with zero saved tabs are skipped entirely — if your 3 most recent
  days have nothing saved, the list reaches further back in time until it
  has 7 dates with at least one tab.
- Click a date to filter the main list down to just that day's tabs (search
  is hidden while a date filter is active). Click the same date again to
  clear the filter and return to your normal view.
- Switching to List, Cards, or Least Viewed clears any active date filter.
```

- [ ] **Step 4: Update `docs/zh/user-guide.md`**

In the "这个插件能帮你做什么" bullet list, add a bullet right after the 收藏 bullet:

```markdown
  - 通过**最近 7 天**侧边栏列表，快速跳转到某一天保存的标签页；
```

Add a new section right after "### 收藏与拖动排序" and before "### 最少查看视图":

```markdown
### 最近 7 天侧边栏

在收藏侧边栏下方，**"🕓 最近 7 天"**区域列出最近有保存过标签页的日期：

![最近 7 天侧边栏](../images/zh/manager-recent-days.svg)

- 每一行显示一个日期（"今天"、"昨天"或完整日期）和当天保存的标签页数量。
- 没有保存任何标签页的日子会被完全跳过——如果最近 3 天都没有保存记录，列表
  会往更早的日期继续查找，直到凑够 7 个有保存记录的日期为止。
- 点击某个日期，可以把主列表筛选为只显示那一天保存的标签页（筛选生效时会
  隐藏搜索框）。再次点击同一个日期，即可取消筛选，回到正常视图。
- 切换到列表、卡片或最少查看视图时，会自动清除当前生效的日期筛选。
```

- [ ] **Step 5: Create `docs/images/en/manager-recent-days.svg`**

```xml
<svg viewBox="0 0 1000 500" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, sans-serif">
  <rect x="0" y="0" width="1000" height="500" fill="#ffffff"/>

  <!-- favorites sidebar -->
  <rect x="30" y="30" width="200" height="140" rx="12" fill="#ffffff" stroke="#e5e7eb"/>
  <text x="44" y="54" font-size="13" font-weight="600" fill="#1a1a1a">★ Favorites</text>
  <rect x="44" y="68" width="172" height="60" rx="8" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="54" y="88" font-size="12" font-weight="500" fill="#1a1a1a">Anthropic Claude Docs</text>
  <text x="54" y="104" font-size="10" fill="#6b7280">docs.anthropic.com</text>
  <text x="204" y="82" font-size="12" fill="#2563eb" text-anchor="end">★</text>

  <!-- recent 7 days sidebar -->
  <rect x="30" y="186" width="200" height="290" rx="12" fill="#ffffff" stroke="#e5e7eb"/>
  <text x="44" y="210" font-size="13" font-weight="600" fill="#1a1a1a">🕓 Recent 7 Days</text>

  <rect x="44" y="222" width="172" height="30" rx="8" fill="#2563eb"/>
  <text x="54" y="241" font-size="12" font-weight="500" fill="#ffffff">Today</text>
  <text x="204" y="241" font-size="12" fill="#ffffff" text-anchor="end">4</text>

  <rect x="44" y="258" width="172" height="30" rx="8" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="54" y="277" font-size="12" font-weight="500" fill="#1a1a1a">Yesterday</text>
  <text x="204" y="277" font-size="12" fill="#6b7280" text-anchor="end">2</text>

  <rect x="44" y="294" width="172" height="30" rx="8" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="54" y="313" font-size="12" font-weight="500" fill="#1a1a1a">7/28/2026</text>
  <text x="204" y="313" font-size="12" fill="#6b7280" text-anchor="end">1</text>

  <rect x="44" y="330" width="172" height="30" rx="8" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="54" y="349" font-size="12" font-weight="500" fill="#1a1a1a">7/25/2026</text>
  <text x="204" y="349" font-size="12" fill="#6b7280" text-anchor="end">3</text>

  <rect x="44" y="366" width="172" height="30" rx="8" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="54" y="385" font-size="12" font-weight="500" fill="#1a1a1a">7/19/2026</text>
  <text x="204" y="385" font-size="12" fill="#6b7280" text-anchor="end">1</text>

  <text x="44" y="416" font-size="10" fill="#9aa1ac">Days with no saved tabs are skipped —</text>
  <text x="44" y="430" font-size="10" fill="#9aa1ac">7/26–27 and 7/20–24 had none.</text>

  <!-- main content -->
  <text x="250" y="54" font-size="20" font-weight="600" fill="#1a1a1a">Saved Links</text>
  <text x="250" y="72" font-size="12" fill="#6b7280">4 tabs from Today</text>

  <rect x="560" y="34" width="90" height="28" fill="#2563eb"/>
  <text x="605" y="52" font-size="11" fill="#ffffff" text-anchor="middle" font-weight="500">☰ List</text>
  <rect x="650" y="34" width="90" height="28" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="695" y="52" font-size="11" fill="#6b7280" text-anchor="middle" font-weight="500">▦ Cards</text>
  <rect x="740" y="34" width="90" height="28" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="785" y="52" font-size="10" fill="#6b7280" text-anchor="middle" font-weight="500">🕓 Least Viewed</text>

  <rect x="850" y="34" width="120" height="28" rx="8" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="910" y="52" font-size="10" fill="#1a1a1a" text-anchor="middle">Connect a different file</text>

  <text x="250" y="90" font-size="11" fill="#9aa1ac">(Search is hidden while a date filter is active)</text>

  <rect x="250" y="100" width="720" height="50" rx="10" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="266" y="120" font-size="13" font-weight="500" fill="#1a1a1a">anthropics/claude-code: Claude Code</text>
  <text x="266" y="138" font-size="11" fill="#6b7280">https://github.com/anthropics/claude-code · 8/2/2026</text>
  <text x="892" y="130" font-size="13" fill="#2563eb" text-anchor="middle">★</text>
  <rect x="906" y="115" width="54" height="24" rx="6" fill="#ffffff" stroke="#e5e7eb"/>
  <text x="933" y="131" font-size="10" fill="#6b7280" text-anchor="middle">Remove</text>

  <rect x="250" y="158" width="720" height="50" rx="10" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="266" y="178" font-size="13" font-weight="500" fill="#1a1a1a">Issues · anthropics/claude-code</text>
  <text x="266" y="196" font-size="11" fill="#6b7280">https://github.com/anthropics/claude-code/issues · 8/2/2026</text>
  <text x="892" y="188" font-size="13" fill="#9aa1ac" text-anchor="middle">☆</text>
  <rect x="906" y="173" width="54" height="24" rx="6" fill="#ffffff" stroke="#e5e7eb"/>
  <text x="933" y="189" font-size="10" fill="#6b7280" text-anchor="middle">Remove</text>

  <rect x="250" y="216" width="720" height="50" rx="10" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="266" y="236" font-size="13" font-weight="500" fill="#1a1a1a">Pull requests · anthropics/claude-code</text>
  <text x="266" y="254" font-size="11" fill="#6b7280">https://github.com/anthropics/claude-code/pulls · 8/2/2026</text>
  <text x="892" y="246" font-size="13" fill="#9aa1ac" text-anchor="middle">☆</text>
  <rect x="906" y="231" width="54" height="24" rx="6" fill="#ffffff" stroke="#e5e7eb"/>
  <text x="933" y="247" font-size="10" fill="#6b7280" text-anchor="middle">Remove</text>

  <rect x="250" y="274" width="720" height="50" rx="10" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="266" y="294" font-size="13" font-weight="500" fill="#1a1a1a">How to use the File System Access API</text>
  <text x="266" y="312" font-size="11" fill="#6b7280">https://stackoverflow.com/questions/123456 · 8/2/2026</text>
  <text x="892" y="304" font-size="13" fill="#9aa1ac" text-anchor="middle">☆</text>
  <rect x="906" y="289" width="54" height="24" rx="6" fill="#ffffff" stroke="#e5e7eb"/>
  <text x="933" y="305" font-size="10" fill="#6b7280" text-anchor="middle">Remove</text>
</svg>
```

- [ ] **Step 6: Create `docs/images/zh/manager-recent-days.svg`**

Same file as Step 5's `docs/images/en/manager-recent-days.svg`, with these text substitutions (matching how the existing `docs/images/zh/*.svg` mockups differ from their `en` counterparts — labels translated, URLs/dates unchanged):

- `"★ Favorites"` → `"★ 收藏"`
- `"🕓 Recent 7 Days"` → `"🕓 最近 7 天"`
- `"Today"` → `"今天"`
- `"Yesterday"` → `"昨天"`
- `"Days with no saved tabs are skipped —"` → `"没有保存记录的日子会被跳过 ——"`
- `"7/26–27 and 7/20–24 had none."` → `"7/26–27 和 7/20–24 都没有记录。"`
- `"Saved Links"` → `"已保存的链接"`
- `"4 tabs from Today"` → `"今天保存了 4 条"`
- `"☰ List"` → `"☰ 列表"`
- `"▦ Cards"` → `"▦ 卡片"`
- `"🕓 Least Viewed"` → `"🕓 最少查看"`
- `"Connect a different file"` → `"更换文件"`
- `"(Search is hidden while a date filter is active)"` → `"（日期筛选生效时会隐藏搜索框）"`
- `"Remove"` → `"删除"`

- [ ] **Step 7: Commit**

```bash
git add README.md docs/zh/README.md docs/user-guide.md docs/zh/user-guide.md docs/images/en/manager-recent-days.svg docs/images/zh/manager-recent-days.svg
git commit -m "docs: document the Recent 7 Days sidebar filter"
```
