/**
 * NextAuth.js v5 Compatibility Layer
 *
 * This module provides backward compatibility for existing code
 * while transitioning from NextAuth.js v4 to v5
 */

import { OAuth2Client } from "google-auth-library";
import type { Session } from "next-auth";
import {
  getServiceAccountAuth as _getSAAuth,
  initializeServiceAccountAuth as _initSAAuth,
  isServiceAccountAvailable as _isSAAvailable,
  resetServiceAccountAuth as _resetSAAuth,
  auth as nextAuthV5,
} from "../../auth";

// Re-export types from the old auth system
export type { ExtendedSession } from "@/types/auth";

/**
 * Backward compatible getServerSession function
 * Replaces the v4 getServerSession calls
 */
export async function getServerSession(): Promise<Session | null> {
  return await nextAuthV5();
}

/**
 * Create Google OAuth client with access tokens
 */
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

/**
 * Create Google OAuth client with fallback to service account
 */
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

/**
 * Placeholder service account functions
 */
export async function getServiceAccountAuth() {
  return _getSAAuth();
}
export function isServiceAccountAvailable(): boolean {
  return _isSAAvailable();
}
export function initializeServiceAccountAuth() {
  return _initSAAuth();
}
export function resetServiceAccountAuth() {
  return _resetSAAuth();
}

/**
 * Placeholder for authOptions (not needed in v5 but kept for compatibility)
 * @deprecated Use the new auth() function directly
 */
export const authOptions = {};

/**
 * Re-export auth function from v5
 */
export const auth = nextAuthV5;
