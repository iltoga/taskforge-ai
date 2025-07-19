#!/usr/bin/env node

console.log("🔧 NextAuth.js Environment Check:");
console.log("=====================================");

// Check environment variables
console.log("NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("BYPASS_GOOGLE_AUTH:", process.env.BYPASS_GOOGLE_AUTH);
console.log(
  "GOOGLE_CLIENT_ID:",
  process.env.GOOGLE_CLIENT_ID ? "✅ Configured" : "❌ Missing"
);
console.log(
  "GOOGLE_CLIENT_SECRET:",
  process.env.GOOGLE_CLIENT_SECRET ? "✅ Configured" : "❌ Missing"
);

// Check URL validity
try {
  const url = new URL(process.env.NEXTAUTH_URL || "http://localhost:3000");
  console.log("URL Protocol:", url.protocol);
  console.log("URL Hostname:", url.hostname);
  console.log("URL Port:", url.port);
  console.log("URL Path:", url.pathname);

  // Expected callback URL
  const callbackUrl = `${process.env.NEXTAUTH_URL}/api/auth/callback/google`;
  console.log("Expected Google callback URL:", callbackUrl);
} catch (error) {
  console.error("❌ Invalid NEXTAUTH_URL:", error);
}

// Check session strategy
const sessionStrategy =
  process.env.BYPASS_GOOGLE_AUTH === "true" ||
  process.env.NODE_ENV === "development"
    ? "jwt"
    : "database";
console.log("Session Strategy:", sessionStrategy);

console.log("=====================================");
