import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The trip reports and guides are Markdown files read from disk. This makes sure they travel
  // with the pages that read them when the site is deployed.
  outputFileTracingIncludes: {
    '/': ['./content/**/*'],
    '/trips': ['./content/**/*'],
    '/trips/[slug]': ['./content/**/*'],
    '/guides': ['./content/**/*'],
    '/guides/[slug]': ['./content/**/*'],
    '/sitemap.xml': ['./content/**/*'],
  },
  images: {
    // Country photos come straight from the photo site's own image server (Unsplash,
    // or Pexels as the fallback). The cards load them from there with photoLoader in
    // app/lib/countryImage.ts, as Unsplash asks. This allow-list is what lets
    // next/image accept those hosts if its built-in optimizer is ever used for them.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
