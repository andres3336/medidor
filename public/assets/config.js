/**
 * The published Google Sheet, read-only.
 * The app never writes to it: new and corrected readings are entered in the sheet.
 */
export const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHQWU9OZ7oAiJbgZ0ZZPGHOz52CAPbeVlf5h4pPyZzA3QSvFvMIHF6xti43Tw9H4SoPJ0O5T-s-2G5/pub?gid=1567341090&single=true&output=csv'

/** Fixed 20th-of-the-month billing cutoff. The app does not configure it. */
export const CYCLE_DAY = 20
