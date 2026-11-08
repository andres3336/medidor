---
name: Medidor AYA domain
description: Billing rules, derived cycles, readings, projection, outliers, averages, CSV and Google Sheets sync for Medidor AYA. Load before touching public/assets/domain, public/assets/app.js or any money calculation.
---

# Medidor AYA domain

This skill is the operational source of truth for the project. If the code and
this document differ, the document wins and the code must be fixed with tests.

## Golden rule

The published Google Sheet stores **only** `fecha,medicion,nota`. Usage, Δ,
liters, L/h, costs, projections and outliers are derived and recalculated in
memory. Never persist them or add them as columns.

- **Single source:** published Google Sheets CSV, read-only.
- **No local seed:** `buildInitialState()` returns `readings: []`; there is no
  factory data or bundled CSV.
- **No persistence:** state lives in memory; the app needs network on every open.
- The app **does not write** to the sheet. New and corrected readings are entered
  in Google Sheets; the app only reads and replaces.

## Units and formats

- m³, usage and reading: up to 3 decimals.
- Liters: whole numbers.
- L/h: 1 decimal.
- Money: colones, no cents when displayed. `Math.ceil` to the colón.
- Numbers: decimal point and thousands comma (`1,234.567`), like the original CSV.
- Dates: ISO 8601 with a `-06:00` offset; Costa Rica has no DST. The parser also
  accepts `MM/DD/YYYY hh:mm AM/PM`.
- The UI shows dates as uppercase `DD-MMM` (`23-OCT`, `20-NOV`). The table shows
  only the date.
- The exported CSV uses ISO with `-06:00`; the sheet may still use the old
  `MM/DD/YYYY hh:mm AM/PM` format.

## Readings and usage

```
exact      = current_reading - base
billable   = floor(current_reading) - floor(base)
```

If billable is negative, it shows 0 and is marked as suspicious.

Canonical example of the current cycle: base `100.156`, reading `103.910` →
exact `3.754`, billable `3`.

In the historical test photo, cycle 2026-09 runs from base `73.000` to
`100.156` → exact `27.156`, billable `27`.

In the live sheet there are no readings before September 24: cycle 2026-09
starts with the first reading (`79.656`) as its base.

`100.283` is **not** the current cycle base: it is an October 20 reading that
belongs to cycle `2026-10`.

## Billing (ARESEP 2026-10-23)

Combined rates per m³: block 1–15 = 873; 16–30 = 1,772; 31–60 = 2,239;
61+ = 3,849. Combined fixed charge = 3,200 (aqueduct 2,000 + sewer 1,200).

Components per block:

- aqueduct: 437, 875, 1,210, 2,005
- sewer: 408, 867, 997, 1,807
- hydrants: 23, 24, 26, 30
- TPRH: 5, 6, 6, 7

Algorithm:

```
u1 = min(consumption, 15)
u2 = max(0, min(consumption, 30) - 15)
u3 = max(0, min(consumption, 60) - 30)
u4 = max(0, consumption - 60)
each component = sum(u_i × rate_i) + fixed charge (if applicable)
iva = consumption > 30 ? aqueduct_total × 0.13 : 0
total = aqueduct + sewer + hydrants + tprh + iva
```

**IVA applies to the whole aqueduct** (blocks + fixed charge), not just block 3.
The 30 → 31 m³ jump is ₡5,214.70.

Tariffs are read-only in the UI. `calcBill` accepts options for tests, but the
app always uses the full ARESEP table.

Validation vectors (exact total, before rounding):

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

When displayed, `displayTotal` rounds up (31 → ₡48,090). Tests use the exact
total.

## Derived cycles 20 → 20

- Cutoff on the 20th at 00:00, fixed (`CYCLE_DAY = 20`). Not configurable.
- The exact cutoff instant belongs to the **new** cycle (`start <= at < end`).
- Cycle id: `YYYYMM` of the start month. Label: `20-OCT – 20-NOV`.
- The **base** is the last reading **before** the cycle start. If none exists
  (first cycle), the first reading of the cycle is used. With no readings,
  `baseValue = null`.
- Cycles are **not persisted**. They are derived from readings; editing a reading
  on the 19th changes the next cycle's base.
- No manual close, adjusted final reading, `billedM3`, `actualBill`,
  `CycleAdjustment` or audit trail.
- Historical photo of the old seed (test fixture, not in the bundle): cycle
  2026-09 base 73.000, 58 readings, last 100.156; cycle 2026-10 base 100.156
  (Oct 19 21:50), 8 readings, last 103.910. It includes 4 completed September
  days and two hours the sheet has already corrected.
- Previous cycle daily average = exact usage of the previous cycle divided by
  the days from its cutoff to its last reading. For 2026-09 it is ≈ `0.91 m³/day`.
- Missing days: a soft warning if yesterday's reading is missing or the last one
  is older than 36 h. It never blocks.

## Projection

A single projection, no scenarios or sliders:

```
rate = average L/day from the last 7 days with data in the cycle
projected_m3 = exact_usage + rate × remaining_days / 1000
remaining_days = (cycle_end - last_reading) / 24
```

- If there are no recent days, the cycle average is the fallback.
- Projected billable usage is calculated with
  `billableConsumption(projected_reading, base)`.
- The projected bill uses the same block and IVA calculation.
- It is the only “what-if” driven by the readings; there is no worst case,
  safety margin or editable control. The fixed House 1 baseline below is a
  comparison, not a selectable scenario.

## Estimated waste (House 1 vs. House 2)

Fixed estimates compared with the running cycle; nothing is parsed from notes
and nothing is editable in the UI.

- **House 1 baseline:** `HOUSE1_BASELINE_LPD = 395` L/day (3 people, 5 L toilet,
  showers, kitchen and the Mabe LMD1800B0 semi-automatic washer at about half
  load, 3–4 washes a week).
- **House 2 leak:** `HOUSE2_LEAK_LPH = 18` L/h → `HOUSE2_LEAK_LPD = 432` L/day.
  Measured on 2026-11-08: `114.801` → `114.810` in 30 minutes = 9 L.
- A 31-day cycle targets ≈ 12.2 m³ (billable 12, ≈ ₡13,676) for House 1 alone.

```
baseline_cycle_m3 = 395 × cycle_days / 1000
excess_so_far     = max(0, exact_usage − 395 × elapsed_days / 1000)
projected_waste   = max(0, projected_m3 − baseline_cycle_m3)
waste_colones     = max(0, projected_total − baseline_total)
```

- The card shows three extra metrics: House 1 target, House 2 leak and Est.
  waste (m³ plus extra colones, with the excess accumulated so far).
- The colón difference uses exact totals and is rounded only when displayed.
- The charts draw it as a dashed green “House 1 target” line: a constant
  `0.395 m³/day` in Usage and the target bill in Billing.
- It is an estimate, not a receipt and not a promise of the leak rate.

## Block bar and average

- The bar runs 0–60 m³, with ticks every 5 m³.
- `Block1` green: 0–15. `Block2` yellow: 15–30. `Block3` red: 30–60. The legend
  is centered and does not show `60+`.
- The fill takes the current block color; there is a current marker and a dotted
  projection marker.
- If usage exceeds 60, the bar stays at the top and the text still shows the real
  value.
- The card shows three metrics: exact usage with the projected close, last
  reading with the previous cycle daily average, and estimated bill (`≈ ₡…`, an
  estimate, not the receipt). Below them, after a separator line, sit the three
  estimated-waste metrics (see Estimated waste).
- The metrics use a 3-column grid (2 columns on narrow phones); the separator
  spans the full width.
- Cycle daily average = `exact_usage / days_from_cutoff_to_now` in m³/day. It is
  still derived and covered by the tests, but it is no longer displayed in the
  card; it is not used in the charts.
- L/h is not used in the charts; the only baseline drawn is the House 1 target
  line (see Estimated waste).

## Charts

- Two charts, always current vs last, no period filter.
- **Usage:** vertical bars grouped by cycle day. 32 days (`day 1..32`), where day
  1 = the 20th of the month; day 32 is empty because it is the next cutoff.
  Previous bar gray, current blue; if the current day beats the same day of the
  previous cycle, the bar turns amber. Real readings only: no projection, and
  days without a reading stay `null` (empty bar). No block milestones. A dashed
  green line marks the House 1 target (`0.395 m³/day`).
- `buildDailyComparison` aligns day N with day N, uses `buildDailyCycle` with the
  normalized daily series (m³/day) and returns 32 fixed days. It does not
  project.
- **Billing:** estimated ₡ accumulated per cycle day. It does not measure usage:
  it measures the estimated rate with base, `floor`, ARESEP blocks, fixed charge
  and IVA. It keeps the dotted projection and adds a dashed green House 1
  target line (fixed charge → target bill).
- **Block milestones:** one dot per new tariff block reached in each period (15,
  30 and 60 billable m³). `findBlockMilestones` uses the real accumulated series,
  without projection: it uses the first point that crosses the threshold and
  marks that point's day and amount. If one point crosses several blocks, all
  are marked there. If the cycle never reaches a block, there is no dot. They are
  drawn only in Billing.
- Milestones use the period color and are explained in the legend as “block
  change”; the tooltip says `Block N · 15 m³`.
- `buildBillSeries` calculates each point's bill with base, `floor`, ARESEP
  blocks, fixed charge and IVA. `buildBillComparison` returns previous/current
  and the projection.
- Billing aligns accumulated periods up to the maximum; it is an estimated
  comparison.

## Notes

- The note is free text. **Quantities and leak phrases are not parsed.**
- There is no `no_explicado`, note signals or automatic suggested actions.
- Old “23 L − 6 L = 17 L” cases are out of scope and must not come back without a
  plan change.

## Daily series and outliers

- L/day per normalized interval: the last reading of the day against the last
  reading of the **previous day with data**, divided by the real hours. Gaps do
  not create peaks.
- Outliers are computed **per cycle**, only over the window of the **last 14
  days with data in that cycle**.
- Normal baseline: median of those 14 days, p25–p75 band, discarding values above
  the limit.
- Outlier: `value > max(median × 2, median + 3×MAD)`.
- With fewer than 5 clean days, the baseline is insufficient and the cycle
  average is used as reference.
- The result only feeds the table warning icon (and the red color in the chart).
  It generates no cards or conclusions.
- An outlier outside the cycle's 14-day window is not marked.

## Readings table

- Raw data, newest first, one row per reading: date `DD-MMM`, reading m³, Δ m³,
  Δ L, L/h without a unit in the cell, and the note on a single line.
- On mobile, Δ m³ and the note are hidden.
- The table is **read-only**: no tap, Enter or gesture edits. New and corrected
  readings are entered in Google Sheets.
- No delete, action icons or filters.
- Search filters by note or reading.
- Only outliers show the warning icon at the start of the row.

## State, sheet and CSV

- State = `{ readings }`. State lives in memory.
- `Reading` = `{ id, at, value, note }`. `parseReadingsCsv()` builds those four
  properties.
- **Google Sheets sync:** `public/assets/app.js` fetches the published CSV
  (`cache: 'no-store'`, 8 s timeout and a `t` parameter per attempt to bypass the
  CDN cache) on start, when the tab becomes visible, when the network recovers
  and when the header arrow is pressed. A manual sync reports
  `Sheet updated: N readings` or the error via a toast.
- The header has light/dark theme, refresh and Settings. The Data section in
  Settings only reports the status and the last sync.
- **Sync:** every sheet read replaces the in-memory readings. There is no merge
  and no local rows.
- No local seed: the app starts with `readings: []` (`buildInitialState`). The
  sheet is the only source and state lives in memory.
- The live sheet starts on 2026-09-20 08:40 with `73.000` and continues with
  `74.780`, `76.350` and `77.950`, marked as `medicion simulada`; Sept 24 is
  `79.656`.
- The historical test photo keeps the old values for those days: Sept 20
  `73.000`, Sept 21 `74.635`, Sept 22 `76.270`, Sept 23 `77.905`. The sheet and
  the fixture do not match on those three decimals, and they do not need to: the
  fixture is a frozen photo, not the live sheet.
- Deduplication by `fecha|medicion`.
- The parser tolerates extra columns from old CSVs; export is atomic.
- There is no UI import and no writing to the sheet.
- There is no token, JSON backup or reset.

## Security and privacy

- There is no token or account. The app reads a public CSV with CORS: reading
  needs no credentials and writing is not supported.
- Never store a PAT in the repo, state, local storage, the CSV or the logs.
- **The published sheet is public:** notes with names or addresses are visible
  to anyone with the link.
- Writing to the sheet in the future would need Google OAuth or an Apps
  Script/backend, not a PAT in the app.

## Language

- “approximate”, “≈”, “normal”, “unusual”, “possible”.
- No cents or false precision.
- The bill is an estimate; the real receipt wins.

## Files

- Implementation: `public/assets/domain/*.js` (anomalies, billing, constants,
  csv, cycles, dates, format, gaps, initialState, periods, projections, readings,
  stats, tariffs, analytics) and `public/assets/app.js` for sync/UI.
- Tests: `test/*.test.js` (84 cases), with the historical photo of the old seed in
  `test/fixtures/mediciones.js`.
- Initial state: `public/assets/domain/initialState.js`
  (`buildInitialState()` with `readings: []`).
- User documentation: `README.md`.
- UI: `public/assets/app.js` + `public/assets/charts.js` (one page + Settings).
