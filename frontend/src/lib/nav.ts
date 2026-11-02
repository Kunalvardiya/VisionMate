export interface NavItem {
  path: string
  label: string
  /** Phase in which the page becomes functional; null when it already is. */
  phase: number | null
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', phase: null },
  { path: '/camera', label: 'Camera', phase: null },
  { path: '/assistant', label: 'AI Assistant', phase: 3 },
  { path: '/text', label: 'Text Recognition', phase: 4 },
  { path: '/gestures', label: 'Gesture Control', phase: 6 },
  { path: '/translator', label: 'Live Translator', phase: 5 },
  { path: '/settings', label: 'Settings', phase: 7 },
]
