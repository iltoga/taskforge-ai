import { OAuth2Client } from 'google-auth-library';
import NextAuth, { AuthOptions, Session } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';

// Function to refresh the access token
async function refreshAccessToken(token: JWT) {
  try {
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: token.refreshToken as string,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    return {
      ...token,
      accessToken: credentials.access_token,
      accessTokenExpires: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : Date.now() / 1000 + 3600,
      refreshToken: credentials.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };
  } catch (error) {
    console.log('Error refreshing access token:', error);

    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

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
    async jwt({ token, account }: { token: JWT; account: unknown }) {
      // Persist the OAuth access_token to the token right after signin
      if (account && typeof account === 'object' && account !== null) {
        const accountObj = account as { access_token?: string; refresh_token?: string; expires_at?: number };
        token.accessToken = accountObj.access_token;
        token.refreshToken = accountObj.refresh_token;
        token.accessTokenExpires = accountObj.expires_at;
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.accessTokenExpires as number) * 1000) {
        return token;
      }

      // Access token has expired, try to update it
      return refreshAccessToken(token);
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      // Send properties to the client
      (session as unknown as { accessToken?: string; refreshToken?: string }).accessToken = token.accessToken as string;
      (session as unknown as { accessToken?: string; refreshToken?: string }).refreshToken = token.refreshToken as string;
      return session;
    },
  },
  // Removed custom pages that don't exist - this was likely causing login issues
};

export const createGoogleAuth = (accessToken: string): OAuth2Client => {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return oauth2Client;
};

export default NextAuth(authOptions);
