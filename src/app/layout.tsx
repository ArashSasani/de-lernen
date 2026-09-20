import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import ServiceWorkerInit from './ServiceWorkerInit';
import { THEME_COLOR, THEME_STORAGE_KEY } from '@/constants';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'de·lernen',
  description: 'German vocabulary, Leitner spaced repetition.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'de·lernen',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

// Deliberately no `themeColor` here. The theme is a manual, persisted user
// pref (see lib/theme-prefs.ts) that the server can't know, so the correct
// value only exists in the browser. Letting Next render a theme-color <meta>
// *and* mutating it from the script below produced two conflicting tags:
// React's metadata boundary re-asserts its own server value during
// hydration instead of reconciling the mutated one, and the browser then
// picks whichever comes first. So the script below owns that tag outright —
// it's the only writer, and React never manages it.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

// Runs before hydration to set `data-theme` and create the theme-color meta
// from the stored pref, so a light-theme user doesn't see a dark flash (or a
// mismatched iOS status bar) on cold load. Keep in sync by hand with
// THEME_STORAGE_KEY / theme-prefs.ts — this has to be a literal string, not
// an import, since it's injected as-is into a <script> tag rather than
// executed as a module.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}) === 'delernen-light'
      ? 'delernen-light'
      : 'delernen-dark';
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      theme === 'delernen-light' ? ${JSON.stringify(THEME_COLOR.light)} : ${JSON.stringify(THEME_COLOR.dark)},
    );
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // No `data-theme` prop here on purpose — the blocking inline script
      // in <body> is the sole author of that attribute (it always sets one,
      // defaulting to dark), so React never claims a value for it and has
      // nothing of its own to reconcile against what the script wrote.
      // `suppressHydrationWarning` covers the remaining case where React
      // still notices the script added an attribute it doesn't manage.
      // Before the script runs (or with JS disabled), FlyonUI's `:root`
      // fallback already renders the first declared theme (delernen-dark,
      // see globals.css), so there's no unstyled flash either way.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* First node in <body>, so it's a plain inline script in the served
            HTML that runs during parse, ahead of any content — which is the
            whole point of it. `next/script` can't do this job: even
            `beforeInteractive` only queues the source on `self.__next_s` for
            the framework runtime to eval once its own JS has loaded, far too
            late to prevent the theme flash.

            Kept out of a hand-rolled <head> (which App Router discourages
            anyway) mostly as belt-and-braces against React 19's "Encountered
            a script tag while rendering React component" warning. That
            warning fires when React *creates* a script during a client
            render rather than hydrating the server-rendered one, so it's a
            symptom of hydration being abandoned somewhere else in the tree,
            not of this line — it was last seen while the FlyonUI JS runtime
            was mutating accordion DOM around hydration, and has not
            reappeared since that went away. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ServiceWorkerInit />
        {children}
      </body>
    </html>
  );
}
