import { loadAllowedEmails } from "@/appconfig/email-filter";
import { OAuth2Client } from "google-auth-library";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

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

export const authConfig: NextAuthConfig = {
  providers: [
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
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : undefined;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
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
    console.warn("Service account fallback not available in simplified auth");
  }

  throw new Error("No authentication method available. Provide OAuth tokens.");
};

// Placeholder service account functions
export async function getServiceAccountAuth() {
  console.warn("Service account auth not available in simplified auth");
  return null;
}

export function isServiceAccountAvailable(): boolean {
  return false;
}

// Backward compatible function
export async function getServerSession() {
  return await auth();
}
