# Medidor AYA — repository conventions

## Context

A personal, single-user app to read the water meter and usage per 20 → 20
cycle. Readings are entered in a published Google Sheet; the app only reads and
calculates. The README is the user manual; this file is the working agreement.

The domain rules are in `.opencode/skills/medidor-dominio/SKILL.md`. If the code
differs from these docs, fix the code or the docs; do not invent features.

## Stack

- Vanilla JavaScript ES modules. **No framework and no build step.**
- Node.js 20+ for the local server and tests. No runtime dependencies.
- Chart.js 4 vendored as a UMD build in `public/assets/vendor/`.
- Node test runner (`node --test`) for the domain.
- GitHub Pages deploys `public/` directly from `main`.

## Commands

```sh
npm start            # local dev at http://127.0.0.1:5173
npm test             # 84 domain tests
```

Definition of done: `npm test` green, no new console errors, and the app
downloads the sheet on every open.

## Invariants (non-negotiable)

1. The Google Sheet only has `fecha,medicion,nota`. No derived columns.
2. IVA applies to the **whole aqueduct** when billable usage > 30 m³.
3. Readings are floored before subtracting; money is rounded up only when
   displayed.
4. Cycles are derived 20 → 20. The base is the last reading **before** the 20th
   at 00:00; in the first cycle the first reading of the cycle is used. There is
   no manual close, editable base or audited adjustment.
5. Derived values (usage, L/h, median, bill, projections, outliers) are computed
   in memory.
6. No token. The published sheet is **read-only**: the app does not write to it.
   A PAT never lives in the repo, state, local storage, the CSV or the logs.
7. Dates in `America/Costa_Rica` (UTC-6, no DST).
8. The published sheet is the only source of readings; the app starts with
   `readings: []`. There is no persistence: state lives in memory and every open
   needs network. No seed and no factory data. No account. Sync is a `fetch` of
   the public CSV; if it fails, the empty state is shown.
9. Language is plain English, approximate: “possible leak”, “≈”, “normal/unusual”.
   No false precision.
10. Every new domain rule gets a test with a real sheet case or the historical
    photo in `test/fixtures/mediciones.js`, or a row from the README table.
11. One page (`public/assets/app.js`) and one Settings dialog. No router, bottom
    nav or old screens.
12. Do not reintroduce JSON import/export, backup, reset, manual cycle close or
    note parsing without updating the README, the skill and the tests.
13. There is no create or edit inside the app: the table is read-only. New and
    corrected readings are entered in Google Sheets.
14. The sheet replaces the in-memory readings on every sync. No merge and no
    local rows.

## Structure

- `public/index.html`: static shell, theme bootstrap and script tags.
- `public/assets/app.js`: header, sync, cycle card, table, settings and toasts.
- `public/assets/charts.js`: chart model and Chart.js rendering.
- `public/assets/domain/`: pure logic, no DOM. The most tested part.
  `initialState.js` returns the empty state; `analytics.js` derives everything
  the page needs.
- `public/assets/vendor/`: vendored Chart.js UMD build and license.
- `test/`: Node test suite and the frozen fixture.
- `server.mjs`: zero-dependency static server for local development.
- `README.md`: user manual and project overview.

## Style

- UI and docs in plain English (es-CR data stays as-is in the sheet).
- Visible dates in uppercase `DD-MMM` (`23-OCT`); the table shows only the date.
- Cycle bar 0–60 m³, ticks every 5, green/yellow/red blocks.
- Plain DOM with template strings; escape any user-provided note before
  inserting it into HTML.
- Native `<dialog>` for Settings; `role="progressbar"` for the block bar.
- CSS variables from `public/assets/styles.css`, mobile-first, 44 px targets,
  `prefers-reduced-motion`.
- No new dependencies without justifying weight and maintenance.
- Pure domain functions with explicit parameters (`now` injectable for tests).
- The table shows raw data; never add derived columns to the CSV.

## Out of scope (v1)

Embedded chat/LLM, multiuser, token, writing to the sheet, JSON import/export,
backup, reset, manual cycle close, create/edit inside the app, note parsing,
deleting readings, 7d/30d/all selector, what-if slider, editable tariffs,
blocking missing-days alert, tariff scraping, native app, push notifications,
service worker, offline mode and PWA install.
