import { isEmailAllowed, loadAllowedEmails } from "@/appconfig/email-filter";
import { ServiceAccountAuth } from "@/lib/service-account-auth";
import type { ChatHistory } from "@/types/chat";
import type { ProcessedFile } from "@/types/files";
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
    chatHistory?: ChatHistory;
    processedFiles?: ProcessedFile[];
    fileSearchSignature?: string;
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
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter:
    process.env.BYPASS_GOOGLE_AUTH === "true"
      ? undefined
      : PrismaAdapter(prisma),
  session: {
    strategy: process.env.BYPASS_GOOGLE_AUTH === "true" ? "jwt" : "database",
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
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
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
      return true;
    },

    async jwt({ token, account, user }) {
      // Skip JWT processing for database sessions (only used for bypass mode)
      if (process.env.BYPASS_GOOGLE_AUTH !== "true") {
        return token;
      }

      // Initial sign in (bypass mode only)
      if (account && user) {
        console.log("🔐 Initial sign in, storing bypass tokens");
        return {
          ...token,
          accessToken: "bypass-access-token",
          refreshToken: "bypass-refresh-token",
          accessTokenExpires: Date.now() + 24 * 60 * 60 * 1000, // 24h
        };
      }

      return token;
    },

    async session({ session, user, token, trigger, newSession }) {
      try {
        // Handle different session strategies
        if (process.env.BYPASS_GOOGLE_AUTH === "true") {
          // JWT mode (bypass) - use token data
          session.accessToken = token.accessToken;
          session.refreshToken = token.refreshToken;
          session.error = token.error;

          // For JWT mode, session data would be stored differently
          // For now, we'll use basic session without extended data
          return session;
        } else {
          // Database mode (Google OAuth) - load from database
          if (user?.id) {
            // Load session data from database
            const dbSession = await prisma.session.findFirst({
              where: { userId: user.id },
              orderBy: { expires: "desc" },
            });

            if (dbSession) {
              // Add structured data from database to session
              session.chatHistory =
                (dbSession.chatHistory as unknown as ChatHistory) || [];
              session.processedFiles =
                (dbSession.processedFiles as unknown as ProcessedFile[]) || [];
              session.fileSearchSignature =
                dbSession.fileSearchSignature || undefined;
            }

            // For Google OAuth, we need to get tokens from account
            const account = await prisma.account.findFirst({
              where: { userId: user.id, provider: "google" },
            });

            if (account) {
              session.accessToken = account.access_token || undefined;
              session.refreshToken = account.refresh_token || undefined;

              // Check if token needs refresh
              if (
                account.expires_at &&
                Date.now() > account.expires_at * 1000 - 5 * 60 * 1000
              ) {
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
                  } else {
                    session.error = refreshed.error;
                  }
                } catch (error) {
                  console.error("❌ Token refresh error:", error);
                  session.error = "RefreshAccessTokenError";
                }
              }
            }

            // Handle session updates
            if (trigger === "update" && newSession) {
              await prisma.session.updateMany({
                where: { userId: user.id },
                data: {
                  chatHistory: newSession.chatHistory
                    ? JSON.parse(JSON.stringify(newSession.chatHistory))
                    : session.chatHistory
                    ? JSON.parse(JSON.stringify(session.chatHistory))
                    : undefined,
                  processedFiles: newSession.processedFiles
                    ? JSON.parse(JSON.stringify(newSession.processedFiles))
                    : session.processedFiles
                    ? JSON.parse(JSON.stringify(session.processedFiles))
                    : undefined,
                  fileSearchSignature:
                    newSession.fileSearchSignature ||
                    session.fileSearchSignature,
                },
              });

              // Update session object
              if (newSession.chatHistory)
                session.chatHistory = newSession.chatHistory;
              if (newSession.processedFiles)
                session.processedFiles = newSession.processedFiles;
              if (newSession.fileSearchSignature)
                session.fileSearchSignature = newSession.fileSearchSignature;
            }
          }
        }

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
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET
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
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
};
