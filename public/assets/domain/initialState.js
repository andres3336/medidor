/**
 * First launch: no readings.
 * The published Google Sheet is the only source; state lives in memory.
 */
export function buildInitialState() {
  return {
    readings: [],
  }
}
