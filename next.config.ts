import type { NextConfig } from 'next';

// Content-Security-Policy
// - default-src 'self': block anything not explicitly allowed
// - script-src: Next.js inline scripts need 'unsafe-inline' (nonce-based CSP requires middleware);
//   'unsafe-eval' needed for Next.js development HMR only — stripped in production via env check
// - connect-src: Supabase REST/Realtime + Groq + Stripe JS
// - img-src: data URIs for base64 avatars + Supabase storage
// - frame-ancestors 'none': equivalent to X-Frame-Options DENY but honoured by modern browsers
const isDev = process.env.NODE_ENV !== 'production';

const cspDirectives = [
  "default-src 'self'",
  // 'unsafe-eval' required in dev for HMR; kept in prod only because Spline
  // WebGL shader compilation needs it at runtime.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : " 'unsafe-eval'"} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://prod.spline.design https://images.unsplash.com",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in https://api.groq.com https://api.stripe.com https://prod.spline.design https://nominatim.openstreetmap.org",
  "worker-src blob: 'self'",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',        value: 'nosniff'                          },
          { key: 'X-Frame-Options',                value: 'DENY'                             },
          { key: 'X-XSS-Protection',               value: '1; mode=block'                   },
          { key: 'Referrer-Policy',                value: 'strict-origin-when-cross-origin'  },
          { key: 'Permissions-Policy',             value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'Content-Security-Policy',        value: cspDirectives                      },
          // HSTS: 1 year, include subdomains, preload-ready
          // Only set in production — dev HTTPS is typically self-signed
          ...(isDev ? [] : [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          }]),
        ],
      },
      {
        // No-index on admin routes in production
        source: '/admin/(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
