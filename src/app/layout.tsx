import type { Metadata, Viewport } from 'next';
import { Onest } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/context';
import { GlassFilter } from '@/components/LiquidGlass';
import { MuiProvider } from '@/components/MuiProvider';
import './globals.css';

const onest = Onest({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-onest',
});

// NEXT_PUBLIC_APP_URL is preferred when set. Vercel deployments that don't
// set it fall back to Vercel's own auto-populated VERCEL_URL (no protocol
// prefix included, so it's added here) — this avoids a chicken-and-egg
// problem on a first deploy where the production URL isn't known yet.
// `||` (not `??`) is deliberate: Vercel injects an *empty string*, not
// undefined, for env vars added with no value, and `??` doesn't fall back
// on that.
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://xhunt.app');

export const metadata: Metadata = {
  metadataBase:    new URL(APP_URL),
  title: {
    default:   'X-hunt — AI Mission Experiences',
    template:  '%s · X-hunt',
  },
  description:     'Discover AI-powered missions that guide you through real-world adventures, challenges, and meaningful experiences. Join thousands of explorers.',
  keywords:        ['AI experiences', 'missions', 'gamification', 'adventures', 'xhunt'],
  manifest:        '/manifest.json',
  appleWebApp: {
    capable:        true,
    statusBarStyle: 'black-translucent',
    title:          'X-hunt',
  },
  openGraph: {
    type:        'website',
    locale:      'en_US',
    url:          APP_URL,
    siteName:    'X-hunt',
    title:       'X-hunt — AI Mission Experiences',
    description: 'Discover AI-powered missions that guide you through real-world adventures.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'X-hunt' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'X-hunt — AI Mission Experiences',
    description: 'Discover AI-powered missions that guide you through real-world adventures.',
    images:      ['/og-image.png'],
  },
  robots: {
    index:   true,
    follow:  true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export const viewport: Viewport = {
  width:           'device-width',
  initialScale:    1,
  maximumScale:    5,
  themeColor:      '#22FFAA',
  colorScheme:     'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={onest.variable}>
      <head>
        {/* Apply saved theme synchronously before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('xhunt-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();`,
          }}
        />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
      </head>
      <body
        style={{ fontFamily: 'var(--font-onest), system-ui, sans-serif' }}
        className="min-h-screen bg-muted"
      >
        {/* Global SVG filter for liquid glass distortion — renders nothing visible */}
        <GlassFilter />
        <MuiProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </MuiProvider>
      </body>
    </html>
  );
}
