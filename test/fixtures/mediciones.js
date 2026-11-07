import { makeReading } from '../../public/assets/domain/readings.js'

/**
 * Frozen snapshot of the old seed (66 readings), tests only.
 * It includes the four completed September days and two hours that the sheet
 * has already corrected. It is not imported by the app.
 */
const ROWS = [
  ['2026-09-20T07:00:00-06:00', 73, 'daily reading (completed data, cycle start)'],
  ['2026-09-21T07:00:00-06:00', 74.635, 'daily reading (completed data)'],
  ['2026-09-22T07:00:00-06:00', 76.27, 'daily reading (completed data)'],
  ['2026-09-23T07:00:00-06:00', 77.905, 'daily reading (completed data)'],
  ['2026-09-24T08:41:00-06:00', 79.656, 'daily reading before the house 2 shower tap'],
  ['2026-09-25T07:24:00-06:00', 80.117, 'daily reading before the house 2 shower tap'],
  ['2026-09-26T07:49:00-06:00', 82.005, 'daily reading before the house 2 shower tap'],
  ['2026-09-27T09:32:00-06:00', 82.775, 'daily reading before the house 2 shower tap'],
  ['2026-09-28T06:36:00-06:00', 83.348, 'daily reading before the house 2 shower tap'],
  ['2026-09-29T06:26:00-06:00', 83.945, 'the house 2 shower tap was installed'],
  ['2026-09-29T08:27:00-06:00', 84.17, 'the house 2 shower tap was installed'],
  ['2026-09-29T09:13:00-06:00', 84.178, 'the house 2 shower tap was installed'],
  ['2026-09-29T12:14:00-06:00', 84.28, 'the house 2 shower tap was installed'],
  ['2026-09-29T21:20:00-06:00', 84.302, 'the house 2 shower tap was installed'],
  ['2026-09-30T06:17:00-06:00', 84.351, 'daily reading'],
  ['2026-10-01T07:16:00-06:00', 84.802, 'daily reading'],
  ['2026-10-02T07:07:00-06:00', 85.129, 'daily reading'],
  ['2026-10-02T08:02:00-06:00', 85.173, 'extra reading'],
  ['2026-10-02T09:29:00-06:00', 85.298, 'extra reading'],
  ['2026-10-03T08:03:00-06:00', 86.382, 'daily reading'],
  ['2026-10-03T17:45:00-06:00', 86.731, 'evening reading'],
  ['2026-10-04T08:37:00-06:00', 86.967, 'daily reading'],
  ['2026-10-05T07:58:00-06:00', 87.765, 'daily reading'],
  ['2026-10-05T09:49:00-06:00', 87.965, 'measured because the meter was seen spinning'],
  ['2026-10-05T10:15:00-06:00', 87.979, 'meter still spinning, the shower tap may be open'],
  ['2026-10-05T11:15:00-06:00', 87.989, 'it used little but the meter keeps running'],
  ['2026-10-05T12:28:00-06:00', 88.027, 'talked to Valeria so she would close the shower tap'],
  [
    '2026-10-05T13:28:00-06:00',
    88.028,
    'checked one hour later to confirm, the meter spins but slower',
  ],
  ['2026-10-06T20:31:00-06:00', 88.326, 'daily reading'],
  ['2026-10-07T08:53:00-06:00', 89.767, 'daily reading'],
  ['2026-10-07T13:05:00-06:00', 89.975, 'meter spinning slowly and laundry was done in the morning'],
  ['2026-10-08T14:04:00-06:00', 90.811, 'the neighbors are washing but the meter keeps spinning slowly'],
  ['2026-10-09T06:59:00-06:00', 91.482, 'daily reading - check in the afternoon because the shower tap is sometimes left open'],
  ['2026-10-10T09:38:00-06:00', 92.514, 'daily reading - the meter keeps spinning at least'],
  ['2026-10-11T10:27:00-06:00', 93.283, 'daily reading'],
  ['2026-10-11T11:53:00-06:00', 93.405, 'extra reading - the shower tap was left open'],
  ['2026-10-11T20:24:00-06:00', 93.463, 'evening reading - the open shower tap was closed'],
  ['2026-10-12T08:41:00-06:00', 93.713, 'daily reading'],
  ['2026-10-13T08:40:00-06:00', 94.189, 'daily reading'],
  ['2026-10-13T12:20:00-06:00', 94.387, 'measured because it is loud but they were filling the washing machine in house 2'],
  ['2026-10-14T08:40:00-06:00', 94.878, 'daily reading'],
  ['2026-10-14T22:15:00-06:00', 95.285, 'evening reading, ChatGPT investigating'],
  [
    '2026-10-14T23:15:00-06:00',
    95.289,
    'evening reading one hour later because it should be 0 but it is 0.004',
  ],
  [
    '2026-10-15T15:10:00-06:00',
    96.816,
    'daily reading, laundry in house 1 in the morning and the meter is spinning faster than before',
  ],
  ['2026-10-15T16:00:00-06:00', 96.91, 'extra reading because it keeps spinning'],
  [
    '2026-10-15T21:00:00-06:00',
    97.732,
    'extra reading and now the meter finally stopped, house 2 probably uses the shower tap open to wash',
  ],
  ['2026-10-16T07:35:00-06:00', 97.8, 'daily reading'],
  ['2026-10-17T07:35:00-06:00', 98.674, 'daily reading'],
  ['2026-10-17T12:20:00-06:00', 98.7, 'extra reading'],
  ['2026-10-17T18:20:00-06:00', 98.979, 'extra reading, shower tap open'],
  ['2026-10-17T19:00:00-06:00', 98.999, 'extra reading, shower tap open then closed'],
  ['2026-10-18T09:25:00-06:00', 99.125, 'daily reading'],
  ['2026-10-18T12:50:00-06:00', 99.395, 'extra reading'],
  ['2026-10-18T21:50:00-06:00', 99.73, 'extra reading'],
  ['2026-10-19T09:00:00-06:00', 99.959, 'daily reading'],
  ['2026-10-19T11:55:00-06:00', 100.006, 'extra reading'],
  ['2026-10-19T19:05:00-06:00', 100.14, 'extra reading'],
  ['2026-10-19T21:50:00-06:00', 100.156, 'extra reading, it has been spinning fast all day'],
  [
    '2026-10-20T09:00:00-06:00',
    100.283,
    'daily reading, the AYA worker checked meters while Miriam was showering in house 1. From here it counts toward the next billing month',
  ],
  ['2026-10-20T10:05:00-06:00', 100.283, 'extra reading'],
  [
    '2026-10-21T08:45:00-06:00',
    101.082,
    'daily reading -- no water from 7am to 7pm, at night about 20L+5L+10L were stored',
  ],
  ['2026-10-22T07:45:00-06:00', 101.537, 'daily reading -- laundry in house 2'],
  ['2026-10-23T08:15:00-06:00', 103.054, 'daily reading'],
  [
    '2026-10-23T09:20:00-06:00',
    103.077,
    'extra reading - 6 liters were used. Check again after an hour because the meter keeps spinning',
  ],
  ['2026-10-23T21:23:00-06:00', 103.643, 'extra reading'],
  ['2026-10-24T09:07:00-06:00', 103.91, 'daily reading'],
]

export function fixtureReadings() {
  return ROWS.map(([at, value, note]) => makeReading({ at, value, note }))
}

export function fixtureState() {
  return { readings: fixtureReadings() }
}
