export type IconName =
  | 'radar'
  | 'list'
  | 'chart'
  | 'search'
  | 'settings'
  | 'book'
  | 'plus'
  | 'download'
  | 'copy'
  | 'sun'
  | 'moon'
  | 'alert'
  | 'check'
  | 'x'
  | 'star'
  | 'trash'
  | 'edit'
  | 'droplet'
  | 'wifiOff'
  | 'refresh'
  | 'chevronDown'
  | 'install'
  | 'arrowRight'
  | 'clock'
  | 'flag'

export const ICON_PATHS: Record<IconName, string[]> = {
  radar: ['M12 12 19 5', 'M12 3a9 9 0 1 0 9 9', 'M12 7a5 5 0 1 0 5 5'],
  list: ['M8 6h13M8 12h13M8 18h13', 'M3 6h.01M3 12h.01M3 18h.01'],
  chart: ['M4 20V10M10 20V4M16 20v-7M22 20H2'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z', 'M16.5 16.5 21 21'],
  settings: ['M4 7h9M17 7h3M4 17h3M11 17h9', 'M15 5v4M7 15v4'],
  book: ['M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 1-2-2V5Z', 'M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6'],
  plus: ['M12 5v14M5 12h14'],
  download: ['M12 3v12M8 11l4 4 4-4M4 21h16'],
  copy: [
    'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Z',
    'M15 9V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4',
  ],
  sun: [
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  ],
  moon: ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z'],
  alert: ['M12 3 2.5 20h19L12 3Z', 'M12 9v5M12 17h.01'],
  check: ['M4 12.5 9 17.5 20 6.5'],
  x: ['M6 6l12 12M18 6 6 18'],
  star: ['M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z'],
  trash: ['M4 7h16M10 11v6M14 11v6', 'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13', 'M9 7V4h6v3'],
  edit: ['M4 20h4L20 8l-4-4L4 16v4Z', 'M14 6l4 4'],
  droplet: ['M12 3c-4.5 5.5-8 9.6-8 13a8 8 0 0 0 16 0c0-3.4-3.5-7.5-8-13Z'],
  wifiOff: [
    'M3 4.5 20.5 22',
    'M5 12.5a11 11 0 0 1 4-2.3M12 8.5a11 11 0 0 1 7 3.2',
    'M8.5 16a5.5 5.5 0 0 1 7 0',
    'M12 20h.01',
  ],
  refresh: ['M20 11a8 8 0 1 0-2.3 6.3', 'M20 5v6h-6'],
  chevronDown: ['M6 9l6 6 6-6'],
  install: ['M12 3v11M8 10l4 4 4-4', 'M4 17v3h16v-3'],
  arrowRight: ['M4 12h15M13 6l6 6-6 6'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5l3 2'],
  flag: ['M6 21V4', 'M6 4h11l-2 4 2 4H6'],
}
