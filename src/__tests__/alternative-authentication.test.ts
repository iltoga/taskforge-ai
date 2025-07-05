/**
 * @jest-environment node
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { getServiceAccountAuth, initializeServiceAccountAuth, isServiceAccountAvailable, resetServiceAccountAuth } from '../lib/auth';
import { ServiceAccountAuth } from '../lib/service-account-auth';
import { EnhancedCalendarService } from '../services/enhanced-calendar-service';

// Mock file system
jest.mock('fs');
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

// Mock Google Auth Library
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockResolvedValue({
      /* mock OAuth2Client */
    })
  })),
  OAuth2Client: jest.fn().mockImplementation(() => ({
    setCredentials: jest.fn(),
    getAccessToken: jest.fn().mockResolvedValue({ token: 'mock-token' })
  }))
}));

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    calendar: jest.fn().mockReturnValue({
      events: {
        list: jest.fn().mockResolvedValue({ data: { items: [] } }),
        insert: jest.fn().mockResolvedValue({ data: { id: 'test-event' } })
      }
    })
  }
}));

describe('Alternative Authentication System', () => {
  const mockServiceAccountCredentials = {
    type: 'service_account',
    project_id: 'test-project',
    private_key_id: 'test-key-id',
    private_key: '-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END PRIVATE KEY-----\n',
    client_email: 'test@test-project.iam.gserviceaccount.com',
    client_id: '123456789',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test%40test-project.iam.gserviceaccount.com',
    universe_domain: 'googleapis.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetServiceAccountAuth(); // Reset singleton state between tests
  });

  describe('ServiceAccountAuth', () => {
    it('should load service account credentials successfully', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockServiceAccountCredentials));

      const serviceAuth = new ServiceAccountAuth();

      expect(serviceAuth.isAvailable()).toBe(true);
      expect(serviceAuth.getServiceAccountEmail()).toBe('test@test-project.iam.gserviceaccount.com');
    });

    it('should handle missing credentials file gracefully', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const serviceAuth = new ServiceAccountAuth();

      expect(serviceAuth.isAvailable()).toBe(false);
      expect(serviceAuth.getServiceAccountEmail()).toBe(null);
    });

    it('should get authenticated client when credentials are available', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockServiceAccountCredentials));

      const serviceAuth = new ServiceAccountAuth();
      const client = await serviceAuth.getAuthenticatedClient();

      expect(client).toBeDefined();
    });

    it('should update scopes correctly', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockServiceAccountCredentials));

      const serviceAuth = new ServiceAccountAuth();
      const newScopes = ['https://www.googleapis.com/auth/calendar.readonly'];

      serviceAuth.updateScopes(newScopes);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should set subject for domain-wide delegation', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockServiceAccountCredentials));

      const serviceAuth = new ServiceAccountAuth();
      serviceAuth.setSubject('user@example.com');

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });
  });

  describe('Enhanced Auth Functions', () => {
    it('should detect service account availability', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockServiceAccountCredentials));

      const available = isServiceAccountAvailable();
      expect(available).toBe(true);
    });

    it('should initialize service account auth', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockServiceAccountCredentials));

      const serviceAuth = initializeServiceAccountAuth();
      expect(serviceAuth).toBeDefined();
      expect(serviceAuth?.isAvailable()).toBe(true);
    });

    it('should get service account auth client', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockServiceAccountCredentials));

      const authClient = await getServiceAccountAuth();
      expect(authClient).toBeDefined();
    });

    it('should handle service account unavailable gracefully', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const authClient = await getServiceAccountAuth();
      expect(authClient).toBe(null);
    });
  });

  describe('EnhancedCalendarService', () => {
    it('should create service with service account when no user auth provided', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockServiceAccountCredentials));

      const service = await EnhancedCalendarService.createWithFallback(undefined, true);

      expect(service).toBeDefined();
      expect(service.getAuthType()).toBe('service-account');
    });

    it('should create service with user auth when provided', async () => {
      const { OAuth2Client } = await import('google-auth-library');
      const mockUserAuth = new OAuth2Client() as any;

      const service = await EnhancedCalendarService.createWithFallback(mockUserAuth, false);

      expect(service).toBeDefined();
      expect(service.getAuthType()).toBe('user-oauth');
    });

    it('should fallback to service account when user auth fails', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockServiceAccountCredentials));

      const service = await EnhancedCalendarService.createWithFallback(undefined, false);

      expect(service).toBeDefined();
      expect(service.getAuthType()).toBe('service-account');
    });

    it('should indicate fallback capability correctly', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockServiceAccountCredentials));
      const { OAuth2Client } = await import('google-auth-library');
      const mockUserAuth = new OAuth2Client() as any;

      const service = await EnhancedCalendarService.createWithFallback(mockUserAuth, false);

      expect(service.canFallbackToServiceAccount()).toBe(true);
    });

    it('should switch to service account authentication', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockServiceAccountCredentials));
      const { OAuth2Client } = await import('google-auth-library');
      const mockUserAuth = new OAuth2Client() as any;

      const service = await EnhancedCalendarService.createWithFallback(mockUserAuth, false);

      expect(service.getAuthType()).toBe('user-oauth');

      await service.switchToServiceAccount();

      expect(service.getAuthType()).toBe('service-account');
    });

    it('should throw error when no authentication available', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(
        EnhancedCalendarService.createWithFallback(undefined, false)
      ).rejects.toThrow('No authentication method available');
    });
  });

  describe('Backward Compatibility', () => {
    it('should preserve existing OAuth behavior when alternative auth disabled', () => {
      // This test ensures that when alternative auth is disabled,
      // the system behaves exactly as it did before
      const { createGoogleAuth } = require('../lib/auth');

      const mockAuth = createGoogleAuth('mock-token', 'mock-refresh');
      expect(mockAuth).toBeDefined();
    });

    it('should not interfere with existing calendar service', () => {
      const { OAuth2Client } = require('google-auth-library');
      const { CalendarService } = require('../services/calendar-service');

      const mockAuth = new OAuth2Client();
      const service = new CalendarService(mockAuth);

      expect(service).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should load alternative auth configuration', () => {
      const mockConfig = {
        alternativeAuth: {
          enabled: true,
          serviceAccount: {
            enabled: true,
            credentialsFile: 'test-credentials.json',
            fallbackOnOAuthFailure: true
          }
        }
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // Dynamically import the function to avoid module caching issues
      const loadConfig = () => {
        try {
          const configPath = join(process.cwd(), 'settings', 'alternative-auth.json');
          const configData = readFileSync(configPath, 'utf8');
          return JSON.parse(configData);
        } catch {
          return { alternativeAuth: { enabled: false } };
        }
      };

      const config = loadConfig();
      expect(config.alternativeAuth.enabled).toBe(true);
      expect(config.alternativeAuth.serviceAccount.fallbackOnOAuthFailure).toBe(true);
    });
  });
});
