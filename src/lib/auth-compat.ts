/**
 * NextAuth.js v5 Compatibility Layer
 *
 * This module provides backward compatibility for existing code
 * while transitioning from NextAuth.js v4 to v5
 */

import type { Session } from "next-auth";
import {
  createGoogleAuthWithFallback,
  getServiceAccountAuth,
  isServiceAccountAvailable,
  auth as nextAuthV5,
  createGoogleAuth as v5CreateGoogleAuth,
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
 * Re-export createGoogleAuth from v5 auth
 */
export const createGoogleAuth = v5CreateGoogleAuth;

/**
 * Re-export other auth functions
 */
export {
  createGoogleAuthWithFallback,
  getServiceAccountAuth,
  isServiceAccountAvailable,
};

/**
 * Placeholder for authOptions (not needed in v5 but kept for compatibility)
 * @deprecated Use the new auth() function directly
 */
export const authOptions = {};

/**
 * Re-export auth function from v5
 */
export const auth = nextAuthV5;
