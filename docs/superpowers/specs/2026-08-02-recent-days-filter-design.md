# Recent 7 Days Sidebar Filter — Design

## Purpose

Add a second sidebar box on the manager page, below the existing Favorites
box, that surfaces the most recent days on which tabs were saved. Clicking a
date filters the main list down to just that day's tabs, so the user can
quickly revisit "what did I save on X".

## Data Layer

New module `src/recentDays.js`, exporting:

- `getDateKey(savedAt)` — converts an ISO timestamp to a local `YYYY-MM-DD`
  string. Used both for grouping and for checking whether a given link
  belongs to a selected date.
- `getRecentDayGroups(links, count = 7)` — groups all links by `getDateKey`,
  sorts the resulting dates descending (most recent first), and returns the
  top `count` dates that have at least one link, each as
  `{ date, links }` with `links` sorted newest-`savedAt`-first.

Grouping by existing map keys means empty days never appear at all — there's
no need to walk the calendar day by day skipping empty ones. If a date has
zero saved links, it simply isn't a key in the map, so the 7 dates returned
are naturally "the last 7 days that had at least one tab," reaching back
further in time as needed to fill 7.

If fewer than 7 distinct dates exist in total, all of them are returned
(no error, no padding).

## UI Layout

- `manager.html`: wrap the existing `#favorites-sidebar` and a new
  `#recent-days-sidebar` in a shared flex-column wrapper (`.sidebar-column`)
  so both boxes stack in the left column. The sticky/scroll positioning
  currently on `.favorites-sidebar` moves to `.sidebar-column`; the two
  `<aside>` boxes keep their border/padding/radius styling (extracted to a
  shared `.sidebar-box` class reused by both).
- New box: title (e.g. "🕓 Recent 7 Days"), and a `#recent-days-list`
  containing one button per date:
  - Label: "Today" / "Yesterday" for the two most recent calendar dates,
    otherwise `toLocaleDateString()` (matching the date format already used
    elsewhere in the manager page).
  - A count badge showing how many tabs were saved that day.
  - `aria-pressed` reflects whether that date is the active filter, styled
    like the existing `.view-toggle-btn[aria-pressed="true"]` treatment.
- Empty state: if there are no saved links at all, show a message in the box
  (same pattern as the Favorites box's empty state), rather than hiding it.

## Interaction / State

- New manager.js state: `let selectedDate = null;` (a `YYYY-MM-DD` string or
  null). Not persisted — resets on reload, unlike `viewMode`.
- Clicking a date button toggles it: clicking the already-selected date sets
  `selectedDate = null`; clicking any other date sets `selectedDate` to that
  date.
- Clicking any of the List / Cards / Least Viewed toggle buttons clears
  `selectedDate` (they are mutually exclusive filter dimensions from the
  date filter).
- Rendering: in `render()`, if `selectedDate` is set, it takes priority over
  `viewMode` — show a flat (non-domain-grouped) `<ul class="link-list">` of
  that date's links using the existing `renderLinkItem`, exactly mirroring
  how `renderLeastViewed()` already bypasses domain grouping. The search
  input is hidden while a date filter is active (same as Least Viewed).
  `linkCountEl` shows `"<n> tab(s) from <label>"`.
- Search text and `selectedDate` are not combined — selecting a date is a
  standalone view, same as Least Viewed is today.
- After any mutation that can change link counts (remove, favorite toggle,
  open), recompute whether `selectedDate` still has at least one matching
  link in `currentLinks`; if not, clear it before rendering (avoids a stuck
  filter pointing at an empty day).

## Testing

`test/recentDays.test.js`, following the style of `test/leastViewed.test.js`:

- Groups links by local date correctly.
- Skips dates with zero links entirely (never appear as empty groups).
- Returns dates sorted most-recent-first.
- Reaches back further than the literal last 7 calendar days when recent
  days are sparse, to fill up to `count` dates.
- Returns fewer than `count` groups when fewer distinct dates exist, without
  erroring.
- Does not mutate the input array.
- Within a group, links are sorted newest-`savedAt`-first.

Manual verification in the manager page (list/card view, selecting/toggling
a date, removing the last tab of a selected date, switching view modes while
a date is selected).

## Documentation Impact

Per project instructions, this is a user-visible feature and requires
updates in the same change:

- `README.md` and `docs/zh/README.md`
- `docs/user-guide.md` and `docs/zh/user-guide.md`
- New mockup pair `manager-recent-days.svg` in `docs/images/en/` and
  `docs/images/zh/`, matching the real CSS added for `.sidebar-column` /
  `.recent-days-sidebar`.

## Out of Scope (YAGNI)

- Combining date filter with text search.
- Persisting the selected date across reloads.
- Configurable day count (hardcoded at 7).
- A calendar/date-picker UI — only the auto-derived recent dates are
  selectable.
