# Tab Saver — Project Instructions

## Documentation must stay in sync with features

Any change to functionality (new feature, changed behavior, removed
feature, changed permission/requirement) MUST update all of the following
in the same change, not as a follow-up:

- `README.md` (English) and `docs/zh/README.md` (Chinese)
- `docs/user-guide.md` (English) and `docs/zh/user-guide.md` (Chinese)
- If the change affects what's visually shown in the manager page or
  popup, update the matching mockups in `docs/images/en/` and
  `docs/images/zh/` too (SVG mockups matching the real CSS, since no
  browser is available to take live screenshots in this environment).

Both language versions are kept in parallel — never update only one. Each
pair cross-links to the other via the `**Language:**` line at the top; keep
that line intact when editing.

Treat "update the docs" as part of the definition of done for a feature
task, not an optional cleanup step afterward.
