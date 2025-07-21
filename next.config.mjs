import withSerwistInit from "@serwist/next";

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

  // Add headers configuration for development
  async headers() {
    return [
      {
        source: '/api/auth/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'development' ? '*' : process.env.NEXTAUTH_URL || '',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,PUT,DELETE,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
          },
        ],
      },
    ];
  },
};

// Disable Serwist in development to avoid Turbopack conflicts
// Only enable in production builds
export default process.env.NODE_ENV === 'development'
  ? nextConfig
  : withSerwistInit({
      swSrc: "src/app/sw.ts",
      swDest: "public/sw.js",
      disable: false,
    })(nextConfig);
