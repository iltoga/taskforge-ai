import { readFileSync } from "fs";
import { OAuth2Client } from "google-auth-library";
import { join } from "path";
import { ServiceAccountAuth } from "./service-account-auth";

// Local, test-friendly implementation of createGoogleAuth
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

  // If explicitly disabled in config, respect that
  if (config.alternativeAuth && config.alternativeAuth.enabled === false) {
    serviceAccountAuthInstance = null;
    return null;
  }

  const credentialsFile = sa?.credentialsFile;
  const credentialsPath = credentialsFile
    ? join(process.cwd(), "settings", credentialsFile)
    : undefined; // Let ServiceAccountAuth use its default when undefined

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
  } catch {
    return null;
  }
}

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
  }

  throw new Error("No authentication method available. Provide OAuth tokens.");
};

// Lazy-forward the v5 auth() only when used, to avoid Jest ESM parsing issues
export async function auth(...args: unknown[]) {
  const mod = await import("../../auth");
  const authFn: (...args: unknown[]) => Promise<unknown> = (
    mod as unknown as {
      auth: (...args: unknown[]) => Promise<unknown>;
    }
  ).auth;
  return authFn(...args);
}
