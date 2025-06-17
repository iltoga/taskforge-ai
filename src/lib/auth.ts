import { OAuth2Client } from 'google-auth-library';
import NextAuth, { AuthOptions, Session } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';

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
        const accountObj = account as { access_token?: string; refresh_token?: string };
        token.accessToken = accountObj.access_token;
        token.refreshToken = accountObj.refresh_token;
      }
      return token;
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
