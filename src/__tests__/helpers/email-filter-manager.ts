import fs from "fs";
import path from "path";
import { AllowedEmailsConfig } from "../../appconfig/email-filter";

/**
 * Utility to manage allowed emails configuration
 */
export class EmailFilterManager {
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath =
      configPath || path.join(process.cwd(), "settings", "allowed-emails.json");
  }

  /**
   * Load current configuration
   */
  private loadConfig(): AllowedEmailsConfig {
    try {
      if (!fs.existsSync(this.configPath)) {
        return { allowedEmails: [] };
      }

      const content = fs.readFileSync(this.configPath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.error("Error loading config:", error);
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
      console.error("Error saving config:", error);
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
    console.log("🧹 Cleared all allowed emails");
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
    const nonGmailEmails = config.allowedEmails.filter(
      (email) => !email.endsWith("@gmail.com")
    );

    if (nonGmailEmails.length > 0) {
      throw new Error(
        `Non-Gmail addresses found: ${nonGmailEmails.join(", ")}`
      );
    }
  }

  /**
   * Get statistics about the current configuration
   */
  getStats(): { totalEmails: number; gmailCount: number; otherCount: number } {
    const emails = this.getAllowedEmails();
    const gmailCount = emails.filter((email) =>
      email.endsWith("@gmail.com")
    ).length;

    return {
      totalEmails: emails.length,
      gmailCount,
      otherCount: emails.length - gmailCount,
    };
  }
}

// Unit tests for EmailFilterManager
describe("EmailFilterManager", () => {
  let manager: EmailFilterManager;
  const testConfigPath = path.join(
    process.cwd(),
    "settings",
    "test-allowed-emails.json"
  );

  beforeEach(() => {
    manager = new EmailFilterManager(testConfigPath);

    // Clean up test file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe("Basic functionality", () => {
    it("should initialize with empty config when file does not exist", () => {
      const emails = manager.getAllowedEmails();
      expect(emails).toEqual([]);
    });

    it("should validate email format correctly", () => {
      expect((manager as any).isValidEmail("test@gmail.com")).toBe(true);
      expect((manager as any).isValidEmail("invalid-email")).toBe(false);
      expect((manager as any).isValidEmail("test@")).toBe(false);
    });

    it("should add email to allowed list", () => {
      const result = manager.addEmail("test@gmail.com");
      expect(result).toBe(true);
      expect(manager.getAllowedEmails()).toContain("test@gmail.com");
    });

    it("should not add duplicate emails", () => {
      manager.addEmail("test@gmail.com");
      const result = manager.addEmail("test@gmail.com");
      expect(result).toBe(false);
      expect(manager.getAllowedEmails().length).toBe(1);
    });

    it("should remove email from allowed list", () => {
      manager.addEmail("test@gmail.com");
      const result = manager.removeEmail("test@gmail.com");
      expect(result).toBe(true);
      expect(manager.getAllowedEmails()).not.toContain("test@gmail.com");
    });

    it("should check if email is allowed", () => {
      manager.addEmail("test@gmail.com");
      expect(manager.isEmailAllowed("test@gmail.com")).toBe(true);
      expect(manager.isEmailAllowed("other@gmail.com")).toBe(false);
    });

    it("should clear all emails", () => {
      manager.addEmail("test1@gmail.com");
      manager.addEmail("test2@gmail.com");
      manager.clearAllEmails();
      expect(manager.getAllowedEmails()).toEqual([]);
    });
  });

  describe("Gmail validation", () => {
    it("should validate Gmail-only emails", () => {
      manager.addEmail("test@gmail.com");
      manager.addEmail("test2@gmail.com");
      expect(() => manager.validateGmailOnly()).not.toThrow();
    });

    it("should throw error for non-Gmail emails", () => {
      manager.addEmail("test@gmail.com");
      manager.addEmail("test@outlook.com");
      expect(() => manager.validateGmailOnly()).toThrow(
        "Non-Gmail addresses found: test@outlook.com"
      );
    });
  });

  describe("Statistics", () => {
    it("should return correct statistics", () => {
      manager.addEmail("test1@gmail.com");
      manager.addEmail("test2@gmail.com");
      manager.addEmail("test@outlook.com");

      const stats = manager.getStats();
      expect(stats.totalEmails).toBe(3);
      expect(stats.gmailCount).toBe(2);
      expect(stats.otherCount).toBe(1);
    });
  });
});
