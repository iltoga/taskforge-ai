import fs from 'fs';
import path from 'path';

export interface AllowedEmailsConfig {
  allowedEmails: string[];
}

/**
 * Load allowed emails configuration from config file
 * @returns Array of allowed email addresses
 */
export function loadAllowedEmails(): string[] {
  try {
    const configPath = path.join(process.cwd(), 'settings', 'allowed-emails.json');

    // Check if config file exists
    if (!fs.existsSync(configPath)) {
      console.warn('⚠️ Allowed emails config file not found, allowing all users');
      return [];
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    const config: AllowedEmailsConfig = JSON.parse(configContent);

    if (!config.allowedEmails || !Array.isArray(config.allowedEmails)) {
      console.warn('⚠️ Invalid allowed emails config format, allowing all users');
      return [];
    }

    // Normalize emails to lowercase for consistent comparison
    const normalizedEmails = config.allowedEmails.map(email => email.toLowerCase().trim());

    console.log(`🔒 Email filtering enabled for ${normalizedEmails.length} allowed emails`);
    return normalizedEmails;
  } catch (error) {
    console.error('❌ Error loading allowed emails config:', error);
    console.warn('⚠️ Falling back to allowing all users');
    return [];
  }
}

/**
 * Check if an email is in the allowed list
 * @param email - Email address to check
 * @param allowedEmails - Array of allowed email addresses
 * @returns true if email is allowed or if no filtering is configured
 */
export function isEmailAllowed(email: string, allowedEmails: string[]): boolean {
  // If no allowed emails are configured, allow all users
  if (allowedEmails.length === 0) {
    return true;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const isAllowed = allowedEmails.includes(normalizedEmail);

  if (!isAllowed) {
    console.log(`🚫 Access denied for email: ${email}`);
  } else {
    console.log(`✅ Access granted for email: ${email}`);
  }

  return isAllowed;
}
