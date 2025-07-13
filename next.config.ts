import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.APP_NAME,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  // Fix for sharp bundling issues in Next.js 15
  serverExternalPackages: ["sharp", "pdftopic"],
  // Explicitly allow cross-origin requests from dev/test origins
  allowedDevOrigins: [
    "https://abcf-103-100-174-215.ngrok-free.app",
    "https://www.calendar-assistant.revisbali.com",
  ],
};

export default nextConfig;
