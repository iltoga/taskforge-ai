import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.APP_NAME,
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_DEBUG: process.env.NEXT_PUBLIC_DEBUG,
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
    process.env.ALLOWED_DEV_ORIGIN_1,
    process.env.ALLOWED_DEV_ORIGIN_2,
    process.env.ALLOWED_DEV_ORIGIN_3,
  ],
};

export default withSerwist(nextConfig);
