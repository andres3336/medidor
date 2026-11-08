# Medidor AYA

A small, read-only AYA water-meter dashboard for Costa Rican colones. Vanilla
JavaScript, no framework and no build step. The app reads a published Google
Sheet and runs entirely in the browser; it is a plain website, not a PWA.

> This is not the official AYA bill. The app estimates and warns; the real
> receipt wins.

## What it does

- Shows the **current 20 → 20 cycle**, two charts and the raw readings table on
  a single page. There is no add or edit button: new and corrected readings are
  entered in Google Sheets.
- Renders three cycle metrics — exact usage with the projected close, last
  reading with the previous cycle average, and estimated bill — above three
  estimated-waste metrics, in one grid with a separator line.
- Compares the cycle with a fixed **House 1 baseline** (3 people and the
  semi-automatic washer) and shows the **estimated waste** in m³ and extra
  colones from the House 2 leak (18 L/h).
- Draws a **0–60 m³ block bar** with ticks every 5 m³ and green/yellow/red
  zones.
- Draws **Usage** (m³ per cycle day, grouped by day against the previous cycle)
  and **Billing** (estimated ₡ accumulated per day, with a dashed projection and
  block milestones).
- Lists every reading newest first: date, reading, Δ m³, Δ L, L/h and note.
  Search filters by note or reading value. Outliers get a warning icon.
- Reads the published CSV fresh on every open, on tab focus, on network recovery
  and when the refresh button is pressed.
- Follows the system light/dark theme, with a manual toggle.

## What it is not

- **Not persistent.** Readings live in memory only. There is no IndexedDB, no
  CSV cache and no offline mode.
- **Not a PWA.** No service worker, no manifest, no install prompt.
- **Read-only.** The app never writes to the sheet and has no account or token.
  The only thing stored on the device is the theme preference.
- **Not a note parser.** Notes are free text; the app never extracts quantities
  or claims a leak.

## Screen

1. **Current cycle** — base, exact and billable usage, estimated bill, the
   House 1 target / House 2 leak / estimated waste metrics (separated by a
   line), block bar and soft warnings (IVA threshold, missing reading).
2. **Charts** — Usage and Billing, full width, no date filter.
3. **Readings** — raw table, newest first, read-only.
4. **Settings** — read-only cycle and tariff details, sync status, Download CSV,
   theme and about. It opens from the gear in the header.

Example with the sheet on Oct 24: reading `103.910 m³`, cycle base
`100.156 m³`, exact usage `3.754 m³`, billable `3 m³` and an estimated bill of
`₡5,819`.

## Money rules (ARESEP 2026-10-23)

Combined rates per m³: block 1–15 = 873; 16–30 = 1,772; 31–60 = 2,239;
61+ = 3,849. Combined fixed charge = 3,200 (aqueduct 2,000 + sewer 1,200).

```
u1 = min(consumption, 15)
u2 = max(0, min(consumption, 30) - 15)
u3 = max(0, min(consumption, 60) - 30)
u4 = max(0, consumption - 60)
each component = sum(u_i × rate_i) + fixed charge
iva = consumption > 30 ? aqueduct_total × 0.13 : 0
total = aqueduct + sewer + hydrants + tprh + iva
```

- **IVA applies to the whole aqueduct** (blocks + fixed charge) once billable
  usage exceeds 30 m³, not only to the marginal block.
- Readings are **floored** before subtracting; money is rounded **up** to the
  colón only when displayed.
- Tariffs are read-only in the app and are never scraped at runtime.

Validation vectors (exact total, before display rounding):

| m³ | total | IVA |
|---:|---:|---:|
| 3 | 5,819 | 0 |
| 15 | 16,295 | 0 |
| 27 | 37,559 | 0 |
| 30 | 42,875 | 0 |
| 31 | 48,089.70 | 2,975.70 |
| 40 | 69,656.40 | 4,391.40 |
| 44 | 79,241.60 | 5,020.60 |
| 60 | 117,582.40 | 7,537.40 |
| 61 | 121,692.05 | 7,798.05 |

The 30 → 31 jump is ₡5,214.70. At display time 31 m³ shows as ₡48,090.

## Cycles 20 → 20

- The cutoff is the 20th at 00:00 Costa Rica time, fixed (`CYCLE_DAY = 20`).
- The exact cutoff instant belongs to the **new** cycle (`start <= at < end`).
- Cycle id: `YYYYMM` of the start month. Label: `20-OCT – 20-NOV`.
- **Base**: the last reading *before* the cycle start. If there is none (first
  cycle), the first reading of the cycle is used. With no readings,
  `baseValue = null`.
- Cycles are derived from readings, never persisted. Editing a reading on the
  19th changes the next cycle's base automatically.
- There is no manual close, adjusted final reading or billed m³.

## Charts

- **Usage** — 32 day slots, day 1 = the 20th. Previous cycle in gray, current in
  blue, amber when the current day beats the same day of the previous cycle.
  Only real readings: days without a measurement stay empty and nothing is
  projected. A dashed green line marks the House 1 target (`0.395 m³/day`).
- **Billing** — estimated ₡ accumulated per day. Solid current line, gray
  previous line, dashed projection, one dot per new tariff block reached (15,
  30 and 60 billable m³) and a dashed green House 1 target line.
- **Projection** — average L/day from the last 7 days with data in the cycle,
  extrapolated to the cutoff. If there are no recent days, the cycle average is
  the fallback.

## Estimated waste (House 1 vs. House 2)

Three estimates keep the leak's cost visible without touching the meter:

- **House 1 target** — `0.395 m³/day` (395 L/day): 3 people, a 5 L toilet,
  showers, kitchen and the Mabe LMD1800B0 semi-automatic washer at about half
  load, 3–4 washes a week. Over a 31-day cutoff: ≈ 12.2 m³, ≈ ₡13,676.
- **House 2 leak** — `18 L/h` (`432 L/day`), measured on 2026-11-08: the meter
  moved from `114.801` to `114.810` in 30 minutes. If it ran 24/7 for a 31-day
  cutoff it would be ≈ 13.4 m³.
- **Est. waste** — the projected close minus the House 1 target, in m³ and in
  extra colones, plus the excess accumulated so far in the cycle.

```
baseline_cycle_m3 = 395 × cycle_days / 1000
excess_so_far     = max(0, exact_usage − 395 × elapsed_days / 1000)
projected_waste   = max(0, projected_m3 − baseline_cycle_m3)
waste_colones     = max(0, projected_total − baseline_total)
```

Both baselines are fixed estimates, not readings: the app never parses notes to
find a leak. They live in `public/assets/domain/constants.js` and are not
editable in the UI. The same target appears as a dashed green line on both
charts.

## Outliers

The daily series is normalized by real hours, so gaps do not create fake peaks.
Outliers are computed per cycle over the last 14 days with data in that cycle:

- normal baseline: median, p25–p75 band and MAD, discarding values above
  `max(median × 2, median + 3 × MAD)`;
- outlier: `value > max(median × 2, median + 3 × MAD)`;
- with fewer than 5 clean days the baseline is insufficient and the cycle
  average is used.

The result only drives the table warning icon and the amber chart bars. It does
not generate cards or conclusions.

## Data source

The published CSV URL lives in [`public/assets/config.js`](public/assets/config.js).
Expected columns: `fecha`, `medicion`, `nota`. Extra columns from older exports
are tolerated and ignored; a header is detected by name. The parser accepts the
old Google Sheets format (`MM/DD/YYYY hh:mm AM/PM`) and ISO 8601. A reading
without an offset is interpreted as Costa Rica time (UTC-6, no DST).

- Readings are deduplicated by `fecha|medicion`; the last row wins.
- Each sync replaces the in-memory readings. There is no merge and no local
  rows.
- **Download CSV** writes `medidor.csv` in ISO with a `-06:00` offset, with only
  `fecha,medicion,nota`. Nothing derived is exported.

> **Privacy:** publishing a Google Sheet makes the CSV readable by anyone with
> the link. Do not publish notes with names or addresses you want to keep
> private. The app itself only reads and never writes to the sheet.

## Local development

Requires Node.js 20 or newer. No dependencies to install.

```sh
npm start
```

Open <http://127.0.0.1:5173>. The zero-dependency server in `server.mjs` serves
only `public/` with caching disabled. To serve it to other devices on the local
network:

```sh
HOST=0.0.0.0 npm start
```

## Tests

```sh
npm test
```

The Node test runner covers the domain: CSV parsing, date formats, number
rounding and formatting, cycles, ARESEP billing, projections, daily series,
outliers, periods and the derived analytics. The suite uses the frozen fixture
in `test/fixtures/mediciones.js`, never a live CSV.

## Deployment

The workflow at `.github/workflows/pages.yml` publishes `public/` on every push
to `main`:

1. In the repository, open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually).
4. The site is available at <https://andres3336.github.io/medidor/>.

All paths are relative, so the site works from the `/medidor/` subpath.
`public/.nojekyll` keeps Jekyll out of the way.

## Project structure

```text
public/                 Static site (the only folder deployed)
  index.html
  .nojekyll
  favicon.svg
  assets/
    app.js              UI, sync, theme, settings and toasts
    charts.js           chart model and Chart.js rendering
    config.js           published CSV URL and cycle day
    styles.css
    domain/             pure calculation: cycles, billing, tariffs,
                        dates, readings, CSV, periods, projections,
                        anomalies, gaps, stats, analytics
    vendor/             vendored Chart.js 4 UMD build and license
test/                   Node test suite and frozen fixture
server.mjs              Zero-dependency local static server
package.json            npm start / npm test only, no dependencies
```

## Notes

- Chart.js 4.6.1 is vendored as a UMD build in `public/assets/vendor/` (MIT,
  license included). It is loaded with a plain script tag, so there is no build
  step and no CDN dependency.
- The theme preference is the only value kept in `localStorage`
  (`medidor.theme`). The app removes nothing else because it stores nothing
  else.
- There is no service worker, manifest or cache. Every visit downloads the page,
  its assets and the sheet.
