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
