import { isEmailAllowed, loadAllowedEmails } from '@/appconfig/email-filter';
import { OAuth2Client } from 'google-auth-library';
import NextAuth, { AuthOptions, Session } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';
import { ServiceAccountAuth } from './service-account-auth';

// Interface for the extended JWT token with expiration tracking
interface ExtendedJWT extends JWT {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpires?: number;
  error?: string;
}

// Interface for Google token refresh response
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
async function refreshAccessToken(token: ExtendedJWT): Promise<ExtendedJWT> {
  try {
    console.log('🔄 Refreshing Google access token...');

    const url = 'https://oauth2.googleapis.com/token';
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken!,
      }),
    });

    const refreshedTokens: GoogleTokenResponse = await response.json();

    if (!response.ok) {
      console.error('❌ Token refresh failed:', refreshedTokens);
      throw refreshedTokens;
    }

    console.log('✅ Token refresh successful');

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };
  } catch (error) {
    console.error('❌ Error refreshing access token:', error);

    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

// Load allowed emails configuration at startup
const allowedEmails = loadAllowedEmails();

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Only apply email filtering for Google OAuth
      if (account?.provider === 'google' && user?.email) {
        const allowed = isEmailAllowed(user.email, allowedEmails);
        if (!allowed) {
          console.log(`🚫 Sign-in blocked for unauthorized email: ${user.email}`);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, account, user }): Promise<ExtendedJWT> {
      const extendedToken = token as ExtendedJWT;

      // Initial sign in
      if (account && user) {
        console.log('🔐 Initial sign in, storing tokens');
        return {
          ...extendedToken,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : Date.now() + 60 * 60 * 1000, // 1 hour default
        };
      }

      // Return previous token if the access token has not expired yet
      if (extendedToken.accessTokenExpires && Date.now() < extendedToken.accessTokenExpires - 5 * 60 * 1000) { // Refresh 5 minutes before expiry
        console.log('🟢 Access token still valid');
        return extendedToken;
      }

      // Access token has expired, try to update it
      console.log('🟡 Access token expired, attempting refresh');
      return refreshAccessToken(extendedToken);
    },
    async session({ session, token }): Promise<Session> {
      const extendedToken = token as ExtendedJWT;
      const extendedSession = session as Session & { accessToken?: string; refreshToken?: string; error?: string };

      if (extendedToken) {
        extendedSession.accessToken = extendedToken.accessToken;
        extendedSession.refreshToken = extendedToken.refreshToken;
        extendedSession.error = extendedToken.error;
      }

      return extendedSession;
    },
  },
  // Session strategy must be JWT to enable token refresh
  session: {
    strategy: 'jwt',
  },
  // Removed custom pages that don't exist - this was likely causing login issues
};

/**
 * Alternative authentication methods
 * These provide server-to-server authentication options
 */

// Service account authentication instance
let serviceAccountAuth: ServiceAccountAuth | null = null;

/**
 * Initialize service account authentication
 * This is an alternative to OAuth for server-side operations
 */
export function initializeServiceAccountAuth(): ServiceAccountAuth | null {
  try {
    if (!serviceAccountAuth) {
      serviceAccountAuth = new ServiceAccountAuth();

      if (serviceAccountAuth.isAvailable()) {
        console.log('🔧 Service account authentication initialized:', serviceAccountAuth.getServiceAccountEmail());
      } else {
        console.warn('⚠️ Service account authentication not available (credentials missing)');
        serviceAccountAuth = null;
      }
    }

    return serviceAccountAuth;
  } catch (error) {
    console.error('❌ Failed to initialize service account authentication:', error);
    return null;
  }
}

/**
 * Get authenticated OAuth2Client using service account
 * This is an alternative to user OAuth for server operations
 */
export async function getServiceAccountAuth(): Promise<OAuth2Client | null> {
  try {
    const serviceAuth = initializeServiceAccountAuth();

    if (!serviceAuth) {
      return null;
    }

    return await serviceAuth.getAuthenticatedClient();
  } catch (error) {
    console.error('❌ Failed to get service account authentication:', error);
    return null;
  }
}

/**
 * Check if service account authentication is available
 */
export function isServiceAccountAvailable(): boolean {
  const serviceAuth = initializeServiceAccountAuth();
  return serviceAuth?.isAvailable() ?? false;
}

/**
 * Enhanced version of createGoogleAuth that can fallback to service account
 * Maintains backward compatibility while adding alternative authentication
 */
export const createGoogleAuthWithFallback = async (
  accessToken?: string,
  refreshToken?: string,
  useServiceAccountFallback: boolean = false
): Promise<OAuth2Client> => {
  // First, try to use OAuth tokens if provided (existing behavior)
  if (accessToken) {
    return createGoogleAuth(accessToken, refreshToken);
  }

  // If no OAuth tokens and fallback is enabled, try service account
  if (useServiceAccountFallback) {
    const serviceAuth = await getServiceAccountAuth();
    if (serviceAuth) {
      console.log('🔄 Using service account authentication as fallback');
      return serviceAuth;
    }
  }

  throw new Error('No authentication method available. Provide OAuth tokens or enable service account fallback.');
};

export const createGoogleAuth = (accessToken: string, refreshToken?: string): OAuth2Client => {
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

export default NextAuth(authOptions);

/**
 * Reset service account authentication (for testing)
 */
export function resetServiceAccountAuth(): void {
  serviceAccountAuth = null;
}
