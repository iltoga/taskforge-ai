import { loadAllowedEmails } from "@/appconfig/email-filter";
import { readFileSync } from "fs";
import { OAuth2Client } from "google-auth-library";
import type { User as NextAuthUser } from "next-auth";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { join } from "path";
import { ServiceAccountAuth } from "./src/lib/service-account-auth";

// Load allowed emails configuration at startup
const allowedEmails = loadAllowedEmails();

// Extended session type for our custom data
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
  }
}

const isBypass = process.env.BYPASS_GOOGLE_AUTH === "true";

export const authConfig: NextAuthConfig = {
  providers: isBypass
    ? [
        Credentials({
          name: "Bypass",
          credentials: {
            email: {
              label: "Email",
              type: "text",
              placeholder: "test@bypass.com",
            },
            name: { label: "Name", type: "text", placeholder: "Test User" },
          },
          async authorize(credentials) {
            // In bypass mode, accept anything (or nothing) and return a mock user
            const email =
              typeof credentials?.email === "string" && credentials.email.trim()
                ? credentials.email
                : allowedEmails[0] ?? "test@bypass.com";
            const name =
              typeof credentials?.name === "string" && credentials.name.trim()
                ? credentials.name
                : "Test User";

            const mockUser: NextAuthUser = {
              id: "bypass-user-id",
              email,
              name,
              image: "https://www.gravatar.com/avatar/?d=identicon",
            };
            return mockUser;
          },
        }),
      ]
    : [
        Google({
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

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email;

        // Check if email is in allowed list
        if (!email || !allowedEmails.includes(email)) {
          console.log(`Access denied for email: ${email}`);
          return false;
        }

        console.log(`Access granted for email: ${email}`);
        return true;
      }

      // In bypass mode with Credentials provider, always allow sign-in
      if (account?.provider === "credentials") {
        return true;
      }

      return false;
    },

    async redirect({ url, baseUrl }) {
      // Allow redirect to pages on same origin
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allow callback URLs on same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },

    async jwt({ token, account, user }) {
      // Persist user data to the token right after signin
      if (account && user) {
        if (account.provider === "credentials") {
          // Mock tokens for bypass mode
          token.accessToken = "bypass-access-token";
          token.refreshToken = "bypass-refresh-token";
          token.accessTokenExpires = Date.now() + 1000 * 60 * 60; // 1 hour
        } else {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.accessTokenExpires = account.expires_at
            ? account.expires_at * 1000
            : undefined;
        }

        const u = user as NextAuthUser | undefined;
        token.email = u?.email ?? token.email;
        token.name = u?.name ?? token.name;
        token.picture = u?.image ?? (token.picture as string | undefined);
      }

      return token;
    },

    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.accessTokenExpires = token.accessTokenExpires as number;

      if (token.email) {
        session.user.email = token.email as string;
      }
      if (token.name) {
        session.user.name = token.name as string;
      }
      if (token.picture) {
        session.user.image = token.picture as string;
      }

      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",

  pages: {
    error: "/auth/error",
  },

  events: {
    async signOut() {
      console.log("User signed out");
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

// Helper functions for Google OAuth
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

export const createGoogleAuthWithFallback = async (
  accessToken?: string,
  refreshToken?: string,
  useServiceAccountFallback: boolean = false
): Promise<OAuth2Client> => {
  if (accessToken) {
    return createGoogleAuth(accessToken, refreshToken);
  }

  if (useServiceAccountFallback) {
    const client = await getServiceAccountAuth();
    if (client) return client;
    console.warn("Service account fallback requested but not available");
  }

  throw new Error("No authentication method available. Provide OAuth tokens.");
};

// Alternative auth configuration types
interface AlternativeAuthConfig {
  alternativeAuth?: {
    enabled?: boolean;
    serviceAccount?: {
      enabled?: boolean;
      credentialsFile?: string;
      fallbackOnOAuthFailure?: boolean;
      domainWideDelegate?: boolean;
      subject?: string | null;
      scopes?: string[];
    };
  };
}

let serviceAccountAuthInstance: ServiceAccountAuth | null = null;

function loadAlternativeAuthConfig(): AlternativeAuthConfig {
  try {
    const configPath = join(process.cwd(), "settings", "alternative-auth.json");
    const raw = readFileSync(configPath, "utf8");
    return JSON.parse(raw) as AlternativeAuthConfig;
  } catch {
    return { alternativeAuth: { enabled: false } };
  }
}

export function initializeServiceAccountAuth(): ServiceAccountAuth | null {
  const config = loadAlternativeAuthConfig();
  const sa = config.alternativeAuth?.serviceAccount;
  const enabled = !!(config.alternativeAuth?.enabled && sa?.enabled);

  if (!enabled) {
    serviceAccountAuthInstance = null;
    return null;
  }

  const credentialsFile = sa?.credentialsFile;
  const credentialsPath = credentialsFile
    ? join(process.cwd(), "settings", credentialsFile)
    : undefined;

  serviceAccountAuthInstance = new ServiceAccountAuth({
    credentialsPath,
    subject: sa?.domainWideDelegate && sa?.subject ? sa.subject : undefined,
    scopes: sa?.scopes || [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  });

  return serviceAccountAuthInstance;
}

export function resetServiceAccountAuth(): void {
  serviceAccountAuthInstance = null;
}

export function isServiceAccountAvailable(): boolean {
  if (!serviceAccountAuthInstance) {
    initializeServiceAccountAuth();
  }
  return !!serviceAccountAuthInstance?.isAvailable();
}

export async function getServiceAccountAuth(): Promise<OAuth2Client | null> {
  if (!serviceAccountAuthInstance) {
    initializeServiceAccountAuth();
  }
  if (
    !serviceAccountAuthInstance ||
    !serviceAccountAuthInstance.isAvailable()
  ) {
    return null;
  }
  try {
    return await serviceAccountAuthInstance.getAuthenticatedClient();
  } catch (e) {
    console.warn(
      "Failed to get service account authenticated client:",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

// Backward compatible function
export async function getServerSession() {
  return await auth();
}
