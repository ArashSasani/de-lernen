export const NAV_ITEMS = [
  { href: '/study', label: 'Lernen' },
  { href: '/read', label: 'Lesen' },
  { href: '/dictation', label: 'Diktat' },
  { href: '/grammar', label: 'Grammatik' },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href;
}
