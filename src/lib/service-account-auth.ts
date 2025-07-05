import { readFileSync } from 'fs';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { join } from 'path';

// Interface for Google Service Account credentials
interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

// Configuration for service account authentication
interface ServiceAccountConfig {
  credentialsPath?: string;
  scopes?: string[];
  subject?: string; // For domain-wide delegation
}

/**
 * Creates a Google OAuth2Client using Service Account credentials
 * This provides an alternative authentication method to user OAuth
 * Useful for server-to-server API calls and background operations
 */
export class ServiceAccountAuth {
  private credentials: ServiceAccountCredentials | null = null;
  private googleAuth: GoogleAuth | null = null;
  private scopes: string[];
  private subject?: string;
  private credentialsPath?: string;

  constructor(config: ServiceAccountConfig = {}) {
    this.scopes = config.scopes || [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    this.subject = config.subject;

    // Store credentials path for GoogleAuth
    this.credentialsPath = config.credentialsPath || join(process.cwd(), 'settings', 'gptcalendarintegration-59a55f630b26.json');

    // Load credentials for validation
    this.loadCredentials();
  }

  /**
   * Load service account credentials from file for validation
   */
  private loadCredentials(): void {
    try {
      console.log(`🔐 Loading service account credentials from: ${this.credentialsPath}`);

      const credentialsJson = readFileSync(this.credentialsPath!, 'utf8');
      this.credentials = JSON.parse(credentialsJson);

      console.log(`✅ Service account credentials loaded for: ${this.credentials?.client_email}`);
    } catch (error) {
      console.warn(`⚠️ Failed to load service account credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.credentials = null;
    }
  }

  /**
   * Initialize GoogleAuth with service account
   */
  private initializeGoogleAuth(): GoogleAuth {
    if (this.googleAuth) {
      return this.googleAuth;
    }

    console.log('🔧 Initializing service account GoogleAuth...');

    const authOptions: {
      keyFile: string;
      scopes: string[];
      subject?: string;
    } = {
      keyFile: this.credentialsPath!,
      scopes: this.scopes
    };

    // Add subject for domain-wide delegation if specified
    if (this.subject) {
      authOptions.subject = this.subject;
    }

    this.googleAuth = new GoogleAuth(authOptions);

    console.log('✅ Service account GoogleAuth initialized');
    return this.googleAuth;
  }  /**
   * Get an authenticated OAuth2Client for API calls
   * This is the main method to use for calendar operations
   */
  async getAuthenticatedClient(): Promise<OAuth2Client> {
    if (!this.credentials) {
      throw new Error('Service account credentials not available. Ensure the credentials file exists and is properly formatted.');
    }

    try {
      console.log('🔍 Creating service account JWT client...');

      // Use GoogleAuth to create a JWT client from service account credentials
      const { GoogleAuth } = await import('google-auth-library');

      const auth = new GoogleAuth({
        credentials: this.credentials,
        scopes: this.scopes,
        ...(this.subject && { clientOptions: { subject: this.subject } })
      });

      // Get the authenticated client
      const client = await auth.getClient();

      if (!client) {
        throw new Error('Failed to create authenticated client - GoogleAuth returned null/undefined');
      }

      console.log('✅ Service account JWT client created via GoogleAuth');

      return client as OAuth2Client;
    } catch (error) {
      console.error('❌ Failed to create service account JWT client:', error);
      throw new Error(`Service account authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if service account authentication is available
   */
  isAvailable(): boolean {
    return this.credentials !== null;
  }

  /**
   * Get service account email for logging/debugging
   */
  getServiceAccountEmail(): string | null {
    return this.credentials?.client_email || null;
  }

  /**
   * Update scopes for the service account
   * Note: This will invalidate the current GoogleAuth and require re-initialization
   */
  updateScopes(newScopes: string[]): void {
    this.scopes = newScopes;
    this.googleAuth = null; // Force re-initialization with new scopes
    console.log('🔄 Service account scopes updated:', newScopes);
  }

  /**
   * Set subject for domain-wide delegation
   * This allows the service account to impersonate users in a G Suite domain
   */
  setSubject(subject: string): void {
    this.subject = subject;
    this.googleAuth = null; // Force re-initialization with new subject
    console.log('👤 Service account subject set for delegation:', subject);
  }
}

/**
 * Factory function to create a service account auth instance
 * This provides a simple way to get service account authentication
 */
export function createServiceAccountAuth(config: ServiceAccountConfig = {}): ServiceAccountAuth {
  return new ServiceAccountAuth(config);
}

/**
 * Quick function to get an authenticated OAuth2Client using service account
 * This is a convenience function for simple use cases
 */
export async function getServiceAccountClient(config: ServiceAccountConfig = {}): Promise<OAuth2Client> {
  const serviceAuth = createServiceAccountAuth(config);
  return await serviceAuth.getAuthenticatedClient();
}
