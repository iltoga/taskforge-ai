import fs from 'fs';
import path from 'path';
import { AllowedEmailsConfig } from './email-filter';

/**
 * Utility to manage allowed emails configuration
 */
export class EmailFilterManager {
  private configPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'allowed-emails.json');
  }

  /**
   * Load current configuration
   */
  private loadConfig(): AllowedEmailsConfig {
    try {
      if (!fs.existsSync(this.configPath)) {
        return { allowedEmails: [] };
      }

      const content = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error loading config:', error);
      return { allowedEmails: [] };
    }
  }

  /**
   * Save configuration to file
   */
  private saveConfig(config: AllowedEmailsConfig): void {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }

  /**
   * Get all allowed emails
   */
  getAllowedEmails(): string[] {
    return this.loadConfig().allowedEmails;
  }

  /**
   * Add an email to the allowed list
   */
  addEmail(email: string): boolean {
    const normalizedEmail = email.toLowerCase().trim();

    if (!this.isValidEmail(normalizedEmail)) {
      throw new Error(`Invalid email format: ${email}`);
    }

    const config = this.loadConfig();

    if (config.allowedEmails.includes(normalizedEmail)) {
      console.log(`Email ${normalizedEmail} is already in the allowed list`);
      return false;
    }

    config.allowedEmails.push(normalizedEmail);
    config.allowedEmails.sort(); // Keep the list sorted
    this.saveConfig(config);

    console.log(`✅ Added ${normalizedEmail} to allowed emails list`);
    return true;
  }

  /**
   * Remove an email from the allowed list
   */
  removeEmail(email: string): boolean {
    const normalizedEmail = email.toLowerCase().trim();
    const config = this.loadConfig();

    const index = config.allowedEmails.indexOf(normalizedEmail);
    if (index === -1) {
      console.log(`Email ${normalizedEmail} is not in the allowed list`);
      return false;
    }

    config.allowedEmails.splice(index, 1);
    this.saveConfig(config);

    console.log(`🗑️ Removed ${normalizedEmail} from allowed emails list`);
    return true;
  }

  /**
   * Check if an email is in the allowed list
   */
  isEmailAllowed(email: string): boolean {
    const normalizedEmail = email.toLowerCase().trim();
    const config = this.loadConfig();
    return config.allowedEmails.includes(normalizedEmail);
  }

  /**
   * Clear all allowed emails
   */
  clearAllEmails(): void {
    const config = { allowedEmails: [] };
    this.saveConfig(config);
    console.log('🧹 Cleared all allowed emails');
  }

  /**
   * Basic email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate that all emails are Gmail addresses
   */
  validateGmailOnly(): void {
    const config = this.loadConfig();
    const nonGmailEmails = config.allowedEmails.filter(email => !email.endsWith('@gmail.com'));

    if (nonGmailEmails.length > 0) {
      throw new Error(`Non-Gmail addresses found: ${nonGmailEmails.join(', ')}`);
    }
  }

  /**
   * Get statistics about the current configuration
   */
  getStats(): { totalEmails: number; gmailCount: number; otherCount: number } {
    const emails = this.getAllowedEmails();
    const gmailCount = emails.filter(email => email.endsWith('@gmail.com')).length;

    return {
      totalEmails: emails.length,
      gmailCount,
      otherCount: emails.length - gmailCount
    };
  }
}
