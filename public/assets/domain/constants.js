/**
 * Domain constants. The UI never edits them: they are part of the meter rules.
 */

/** AYA billing cutoff day. Fixed: the app does not configure it. */
export const CYCLE_DAY = 20

export const BASELINE_WINDOW_DAYS = 14
export const OUTLIER_MULTIPLIER = 2
export const OUTLIER_MAD_FACTOR = 3

export const PROJECTION_WINDOW_DAYS = 7

export const FLOW_WARNING_LPH = 1
export const FLOW_DANGER_LPH = 5

export const GAP_WARN_HOURS = 36

/**
 * Estimated waste comparison.
 *
 * House 1 baseline: 3 people (5 L toilet, showers, kitchen) plus the Mabe
 * LMD1800B0 semi-automatic washer at about half load, 3-4 washes a week.
 * House 2 leak: measured on 2026-11-08, 9 L in 30 minutes = 18 L/h.
 * Both are estimates, not meter readings: the UI shows them with "≈".
 */
export const HOUSE1_BASELINE_LPD = 395
export const HOUSE2_LEAK_LPH = 18
export const HOUSE2_LEAK_LPD = HOUSE2_LEAK_LPH * 24
