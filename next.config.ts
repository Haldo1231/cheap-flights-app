import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Country photos come from Unsplash's own image server. The cards load them
    // straight from there (see unsplashLoader in app/lib/countryImage.ts), as
    // Unsplash asks; this allow-list is the safety net if next/image's built-in
    // optimizer is ever used for them.
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
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
