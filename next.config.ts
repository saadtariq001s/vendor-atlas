import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained build for the Docker image (see Dockerfile).
  output: "standalone",
  // Hide the Next.js dev-tools indicator (bottom-left in development).
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
