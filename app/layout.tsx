import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'

const plexSans = IBM_Plex_Sans({
  variable: '--font-sans',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
})

const plexMono = IBM_Plex_Mono({
  variable: '--font-mono',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
})

const DESCRIPTION =
  'Compare cheap flights from Bratislava, Vienna, Budapest, Košice and Prague in one search — exact dates, a whole month, or anywhere — with airlines, times and the total trip cost.'

export const metadata: Metadata = {
  metadataBase: new URL('https://cheap-flights-app.vercel.app'),
  title: {
    default: 'cheapflights — compare cheap flights from 5 Central European airports',
    template: '%s — cheapflights',
  },
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'cheapflights',
    title: 'cheapflights — compare cheap flights from 5 Central European airports',
    description: DESCRIPTION,
    url: '/',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'cheapflights: the cheapest way to fly from Bratislava, Vienna, Budapest, Košice and Prague' }],
  },
  twitter: { card: 'summary_large_image', title: 'cheapflights', description: DESCRIPTION, images: ['/api/og'] },
}

export const viewport: Viewport = {
  // The colour of the browser bar on phones follows the theme.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#14213D' },
    { media: '(prefers-color-scheme: dark)', color: '#08101F' },
  ],
  colorScheme: 'light dark',
}

// Runs before the page is painted, so a saved dark/light choice never flashes the other theme.
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${plexSans.variable} ${plexMono.variable} flex min-h-screen flex-col font-sans antialiased [&:has([data-mobile-bar])_footer]:pb-20 lg:[&:has([data-mobile-bar])_footer]:pb-0`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-sm focus:bg-amber focus:px-4 focus:py-2 focus:font-semibold focus:text-deep"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
