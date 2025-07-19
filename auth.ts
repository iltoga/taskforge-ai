import { isEmailAllowed, loadAllowedEmails } from "@/appconfig/email-filter";
import { ServiceAccountAuth } from "@/lib/service-account-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

// Create global Prisma instance to avoid multiple connections
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Load allowed emails configuration at startup
const allowedEmails = loadAllowedEmails();

// Extended session type for our custom data
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }

  interface User {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

/**
 * Refreshes an access token using the refresh token
 * Based on NextAuth.js refresh token rotation documentation
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    console.log("🔄 Refreshing Google access token...");

    const url = "https://oauth2.googleapis.com/token";
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken!,
      }),
    });

    const refreshedTokens: GoogleTokenResponse = await response.json();

    if (!response.ok) {
      console.error("❌ Token refresh failed:", refreshedTokens);
      throw refreshedTokens;
    }

    console.log("✅ Token refresh successful");

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("❌ Error refreshing access token:", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

// Debug configuration loading (without secrets)
console.log("🔧 NextAuth.js Configuration loaded");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("BYPASS_GOOGLE_AUTH:", process.env.BYPASS_GOOGLE_AUTH);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter:
    process.env.BYPASS_GOOGLE_AUTH === "true" ||
    process.env.NODE_ENV === "development"
      ? undefined
      : PrismaAdapter(prisma),
  session: {
    strategy:
      process.env.BYPASS_GOOGLE_AUTH === "true" ||
      process.env.NODE_ENV === "development"
        ? "jwt"
        : "database",
  },

  providers:
    process.env.BYPASS_GOOGLE_AUTH === "true"
      ? [
          CredentialsProvider({
            name: "Bypass",
            credentials: {
              email: { label: "Email", type: "email", required: true },
              name: { label: "Name", type: "text", required: false },
            },
            async authorize(credentials) {
              const email =
                (credentials?.email as string) || "bypass@example.com";
              const name = (credentials?.name as string) || "Bypass User";
              return {
                id: email,
                email,
                name,
              };
            },
          }),
        ]
      : [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
              params: {
                scope:
                  "openid email profile https://www.googleapis.com/auth/calendar",
                access_type: "offline",
                prompt: "consent",
              },
            },
          }),
        ],

  callbacks: {
    async signIn({ user, account }) {
      console.log("🔐 SignIn callback:", {
        provider: account?.provider,
        email: user?.email,
        account: account
          ? { provider: account.provider, type: account.type }
          : null,
      });

      // Only apply email filtering for Google OAuth
      if (account?.provider === "google" && user?.email) {
        const allowed = isEmailAllowed(user.email, allowedEmails);
        if (!allowed) {
          console.log(
            `🚫 Sign-in blocked for unauthorized email: ${user.email}`
          );
          return false;
        }
      }

      console.log("✅ Sign-in approved for:", user?.email);
      return true;
    },

    async redirect({ url, baseUrl }) {
      console.log("🔄 Redirect callback:", { url, baseUrl });

      // For development, ensure we use the correct base URL
      const isLocalDev = process.env.NODE_ENV === "development";
      const effectiveBaseUrl = isLocalDev ? "http://localhost:3000" : baseUrl;

      // Allows relative callback URLs
      if (url.startsWith("/")) {
        const redirectUrl = `${effectiveBaseUrl}${url}`;
        console.log("📍 Redirecting to:", redirectUrl);
        return redirectUrl;
      }

      // Allows callback URLs on the same origin
      try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(effectiveBaseUrl);
        if (urlObj.hostname === baseUrlObj.hostname) {
          console.log("📍 Redirecting to same origin:", url);
          return url;
        }
      } catch {
        console.log(
          "❌ Invalid URL format, redirecting to base:",
          effectiveBaseUrl
        );
      }

      console.log("📍 Redirecting to base URL:", effectiveBaseUrl);
      return effectiveBaseUrl;
    },

    async jwt({ token, account, user }) {
      console.log("🔑 JWT callback:", {
        hasAccount: !!account,
        hasUser: !!user,
        accountProvider: account?.provider,
        tokenStrategy:
          process.env.BYPASS_GOOGLE_AUTH !== "true" &&
          process.env.NODE_ENV !== "development"
            ? "database"
            : "jwt",
      });

      // Skip JWT processing for database sessions (only used for bypass mode and dev)
      if (
        process.env.BYPASS_GOOGLE_AUTH !== "true" &&
        process.env.NODE_ENV !== "development"
      ) {
        console.log("📝 Using database sessions, skipping JWT processing");
        return token;
      }

      // Initial sign in
      if (account && user) {
        console.log("🔐 Initial sign in, storing tokens");

        if (account.provider === "google") {
          const newToken = {
            ...token,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            accessTokenExpires: account.expires_at
              ? account.expires_at * 1000
              : undefined,
          };
          console.log("🔑 Google token stored:", {
            hasAccessToken: !!newToken.accessToken,
            hasRefreshToken: !!newToken.refreshToken,
            expiresAt: newToken.accessTokenExpires,
          });
          return newToken;
        } else {
          // Bypass mode
          const newToken = {
            ...token,
            accessToken: "bypass-access-token",
            refreshToken: "bypass-refresh-token",
            accessTokenExpires: Date.now() + 24 * 60 * 60 * 1000, // 24h
          };
          console.log("🔑 Bypass token created");
          return newToken;
        }
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        console.log("🔑 Token still valid, returning existing");
        return token;
      }

      // Access token has expired, try to update it
      if (token.refreshToken) {
        console.log("🔄 Attempting to refresh token");
        return refreshAccessToken(token);
      }

      console.log("🔑 Returning token as-is");
      return token;
    },

    async session({ session, user, token }) {
      try {
        console.log("📝 Session callback:", {
          hasUser: !!user,
          hasToken: !!token,
          userId: user?.id,
          sessionEmail: session.user?.email,
        });

        // Handle different session strategies
        if (
          process.env.BYPASS_GOOGLE_AUTH === "true" ||
          process.env.NODE_ENV === "development"
        ) {
          // JWT mode (bypass or development) - use token data
          session.accessToken = token.accessToken;
          session.refreshToken = token.refreshToken;
          session.error = token.error;

          console.log("📝 JWT session created:", {
            hasAccessToken: !!session.accessToken,
            hasRefreshToken: !!session.refreshToken,
            error: session.error,
          });
          return session;
        } else {
          // Database mode (Google OAuth) - load from database
          if (user?.id) {
            console.log("📝 Loading Google OAuth session for user:", user.id);

            try {
              // Test database connection
              await prisma.$connect();
              console.log("✅ Database connected");

              // For Google OAuth, we need to get tokens from account
              const account = await prisma.account.findFirst({
                where: { userId: user.id, provider: "google" },
              });

              if (account) {
                console.log("📝 Found Google account:", {
                  provider: account.provider,
                  hasAccessToken: !!account.access_token,
                  expiresAt: account.expires_at,
                });

                session.accessToken = account.access_token || undefined;
                session.refreshToken = account.refresh_token || undefined;

                // Check if token needs refresh
                if (
                  account.expires_at &&
                  Date.now() > account.expires_at * 1000 - 5 * 60 * 1000
                ) {
                  console.log("🔄 Token needs refresh");
                  try {
                    const refreshed = await refreshAccessToken({
                      refreshToken: account.refresh_token,
                    } as JWT);

                    if (!refreshed.error) {
                      // Update tokens in database
                      await prisma.account.update({
                        where: { id: account.id },
                        data: {
                          access_token: refreshed.accessToken,
                          expires_at: Math.floor(
                            refreshed.accessTokenExpires! / 1000
                          ),
                          refresh_token: refreshed.refreshToken,
                        },
                      });

                      session.accessToken = refreshed.accessToken;
                      session.refreshToken = refreshed.refreshToken;
                      console.log("✅ Token refreshed successfully");
                    } else {
                      console.error(
                        "❌ Token refresh failed:",
                        refreshed.error
                      );
                      session.error = refreshed.error;
                    }
                  } catch (error) {
                    console.error("❌ Token refresh error:", error);
                    session.error = "RefreshAccessTokenError";
                  }
                }
              } else {
                console.log("⚠️ No Google account found for user");
              }
            } catch (dbError) {
              console.error("❌ Database error in session callback:", dbError);
              // Return session without database tokens if DB fails
              return session;
            }
          }
        }

        console.log("✅ Session created successfully:", {
          userEmail: session.user?.email,
          hasAccessToken: !!session.accessToken,
        });
        return session;
      } catch (error) {
        console.error("❌ Session callback error:", error);
        // Return a minimal session to prevent crashes
        return {
          ...session,
          error: "SessionCallbackError",
        };
      }
    },
  },

  debug: process.env.NODE_ENV === "development",

  trustHost: true, // Important for ngrok and proxied environments

  // Ensure proper cookie handling for development
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "development"
          ? "next-auth.session-token"
          : "__Secure-next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production", // Only secure in production
        domain:
          process.env.NODE_ENV === "development"
            ? undefined
            : new URL(process.env.NEXTAUTH_URL || "").hostname,
      },
    },
    callbackUrl: {
      name:
        process.env.NODE_ENV === "development"
          ? "next-auth.callback-url"
          : "__Secure-next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production", // Only secure in production
        domain:
          process.env.NODE_ENV === "development"
            ? undefined
            : new URL(process.env.NEXTAUTH_URL || "").hostname,
      },
    },
    csrfToken: {
      name:
        process.env.NODE_ENV === "development"
          ? "next-auth.csrf-token"
          : "__Secure-next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production", // Only secure in production
        domain:
          process.env.NODE_ENV === "development"
            ? undefined
            : new URL(process.env.NEXTAUTH_URL || "").hostname,
      },
    },
  },

  pages: {
    error: "/auth/error", // Custom error page
  },

  events: {
    async signOut() {
      // Clean up session data on sign out
      console.log("🚪 User signed out, cleaning up session data");
    },
  },
});

/**
 * Alternative authentication methods - keeping existing service account functionality
 */
let serviceAccountAuth: ServiceAccountAuth | null = null;

export function initializeServiceAccountAuth(): ServiceAccountAuth | null {
  try {
    if (!serviceAccountAuth) {
      serviceAccountAuth = new ServiceAccountAuth();

      if (serviceAccountAuth.isAvailable()) {
        console.log(
          "🔧 Service account authentication initialized:",
          serviceAccountAuth.getServiceAccountEmail()
        );
      } else {
        console.warn(
          "⚠️ Service account authentication not available (credentials missing)"
        );
        serviceAccountAuth = null;
      }
    }

    return serviceAccountAuth;
  } catch (error) {
    console.error(
      "❌ Failed to initialize service account authentication:",
      error
    );
    return null;
  }
}

export async function getServiceAccountAuth() {
  try {
    const serviceAuth = initializeServiceAccountAuth();
    if (!serviceAuth) return null;
    return await serviceAuth.getAuthenticatedClient();
  } catch (error) {
    console.error("❌ Failed to get service account authentication:", error);
    return null;
  }
}

export function isServiceAccountAvailable(): boolean {
  const serviceAuth = initializeServiceAccountAuth();
  return serviceAuth?.isAvailable() ?? false;
}

export const createGoogleAuthWithFallback = async (
  accessToken?: string,
  refreshToken?: string,
  useServiceAccountFallback: boolean = false
): Promise<OAuth2Client> => {
  if (accessToken) {
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return oauth2Client;
  }

  if (useServiceAccountFallback) {
    const serviceAuth = await getServiceAccountAuth();
    if (serviceAuth) {
      console.log("🔄 Using service account authentication as fallback");
      return serviceAuth;
    }
  }

  throw new Error(
    "No authentication method available. Provide OAuth tokens or enable service account fallback."
  );
};

export const createGoogleAuth = (
  accessToken: string,
  refreshToken?: string
): OAuth2Client => {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
};
