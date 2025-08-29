/**
 * @jest-environment node
 */

/**
 * Test suite for email filtering functionality
 */

import fs from "fs";
import path from "path";
import { isEmailAllowed, loadAllowedEmails } from "../appconfig/email-filter";
import { EmailFilterManager } from "./helpers/email-filter-manager";

// Mock file system for testing
jest.mock("fs");
const mockFs = fs as jest.Mocked<typeof fs>;

describe("Email Filtering", () => {
  const testConfigPath = path.join(
    process.cwd(),
    "settings-test",
    "allowed-emails.json"
  );

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console methods
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("loadAllowedEmails", () => {
    it("should return empty array when config file does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = loadAllowedEmails();

      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        "⚠️ Allowed emails config file not found, allowing all users"
      );
    });

    it("should load and normalize email addresses from config file", () => {
      const mockConfig = {
        allowedEmails: [
          "User1@Gmail.com",
          "  user2@GMAIL.COM  ",
          "admin@gmail.com",
        ],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = loadAllowedEmails();

      expect(result).toEqual([
        "user1@gmail.com",
        "user2@gmail.com",
        "admin@gmail.com",
      ]);
      expect(console.log).toHaveBeenCalledWith(
        "🔒 Email filtering enabled for 3 allowed emails"
      );
    });

    it("should handle invalid JSON config gracefully", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("invalid json");

      const result = loadAllowedEmails();

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        "❌ Error loading allowed emails config:",
        expect.any(SyntaxError)
      );
      expect(console.warn).toHaveBeenCalledWith(
        "⚠️ Falling back to allowing all users"
      );
    });

    it("should handle missing allowedEmails property", () => {
      const mockConfig = { someOtherProperty: "value" };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = loadAllowedEmails();

      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        "⚠️ Invalid allowed emails config format, allowing all users"
      );
    });
  });

  describe("isEmailAllowed", () => {
    it("should allow all emails when allowedEmails array is empty", () => {
      const result = isEmailAllowed("anyone@gmail.com", []);

      expect(result).toBe(true);
    });

    it("should allow emails that are in the allowed list", () => {
      const allowedEmails = ["user1@gmail.com", "admin@example.com"];

      expect(isEmailAllowed("user1@gmail.com", allowedEmails)).toBe(true);
      expect(isEmailAllowed("USER1@GMAIL.COM", allowedEmails)).toBe(true); // Case insensitive
      expect(isEmailAllowed(" user1@gmail.com ", allowedEmails)).toBe(true); // Whitespace handling
      expect(console.log).toHaveBeenCalledWith(
        "✅ Access granted for email: user1@gmail.com"
      );
    });

    it("should deny emails that are not in the allowed list", () => {
      const allowedEmails = ["user1@gmail.com", "admin@example.com"];

      expect(isEmailAllowed("unauthorized@gmail.com", allowedEmails)).toBe(
        false
      );
      expect(console.log).toHaveBeenCalledWith(
        "🚫 Access denied for email: unauthorized@gmail.com"
      );
    });

    it("should handle email normalization consistently", () => {
      const allowedEmails = ["user@gmail.com"];

      expect(isEmailAllowed("User@Gmail.Com", allowedEmails)).toBe(true);
      expect(isEmailAllowed("  USER@GMAIL.COM  ", allowedEmails)).toBe(true);
    });
  });

  describe("EmailFilterManager", () => {
    let manager: EmailFilterManager;

    beforeEach(() => {
      manager = new EmailFilterManager();
      // Mock the config directory creation
      mockFs.mkdirSync.mockImplementation(() => undefined);
    });

    describe("addEmail", () => {
      it("should add valid email to empty config", () => {
        mockFs.existsSync.mockReturnValue(false);
        mockFs.writeFileSync.mockImplementation(() => {});

        const result = manager.addEmail("example@example.com");

        expect(result).toBe(true);
        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          expect.stringContaining("allowed-emails.json"),
          JSON.stringify({ allowedEmails: ["example@example.com"] }, null, 2)
        );
      });

      it("should add email to existing config", () => {
        const existingConfig = { allowedEmails: ["existing@gmail.com"] };

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(existingConfig));
        mockFs.writeFileSync.mockImplementation(() => {});

        const result = manager.addEmail("example@example.com");

        expect(result).toBe(true);
        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          expect.stringContaining("allowed-emails.json"),
          JSON.stringify(
            { allowedEmails: ["example@example.com", "existing@gmail.com"] },
            null,
            2
          )
        );
      });

      it("should not add duplicate emails", () => {
        const existingConfig = { allowedEmails: ["existing@gmail.com"] };

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(existingConfig));

        const result = manager.addEmail("existing@gmail.com");

        expect(result).toBe(false);
        expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      });

      it("should reject invalid email format", () => {
        expect(() => manager.addEmail("invalid-email")).toThrow(
          "Invalid email format: invalid-email"
        );
      });

      it("should normalize email case and whitespace", () => {
        mockFs.existsSync.mockReturnValue(false);
        mockFs.writeFileSync.mockImplementation(() => {});

        manager.addEmail("  User@Gmail.COM  ");

        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          expect.stringContaining("allowed-emails.json"),
          JSON.stringify({ allowedEmails: ["user@gmail.com"] }, null, 2)
        );
      });
    });

    describe("removeEmail", () => {
      it("should remove email from config", () => {
        const existingConfig = {
          allowedEmails: ["user1@gmail.com", "user2@gmail.com"],
        };

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(existingConfig));
        mockFs.writeFileSync.mockImplementation(() => {});

        const result = manager.removeEmail("user1@gmail.com");

        expect(result).toBe(true);
        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          expect.stringContaining("allowed-emails.json"),
          JSON.stringify({ allowedEmails: ["user2@gmail.com"] }, null, 2)
        );
      });

      it("should return false when email not found", () => {
        const existingConfig = { allowedEmails: ["user1@gmail.com"] };

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(existingConfig));

        const result = manager.removeEmail("nonexistent@gmail.com");

        expect(result).toBe(false);
        expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      });
    });

    describe("validateGmailOnly", () => {
      it("should pass when all emails are Gmail addresses", () => {
        const config = {
          allowedEmails: ["user1@gmail.com", "user2@gmail.com"],
        };

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(config));

        expect(() => manager.validateGmailOnly()).not.toThrow();
      });

      it("should throw when non-Gmail addresses are present", () => {
        const config = {
          allowedEmails: ["user1@gmail.com", "user2@outlook.com"],
        };

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(config));

        expect(() => manager.validateGmailOnly()).toThrow(
          "Non-Gmail addresses found: user2@outlook.com"
        );
      });
    });

    describe("getStats", () => {
      it("should return correct statistics", () => {
        const config = {
          allowedEmails: [
            "user1@gmail.com",
            "user2@gmail.com",
            "admin@outlook.com",
          ],
        };

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(config));

        const stats = manager.getStats();

        expect(stats).toEqual({
          totalEmails: 3,
          gmailCount: 2,
          otherCount: 1,
        });
      });
    });
  });
});

describe("NextAuth Integration", () => {
  // Mock NextAuth modules
  jest.mock("next-auth", () => ({
    __esModule: true,
    default: jest.fn(),
  }));

  jest.mock("next-auth/providers/google", () => ({
    __esModule: true,
    default: jest.fn(),
  }));

  it.skip("should test email filtering in signIn callback", async () => {
    // This test is skipped because we're using NextAuth v5 which doesn't have the same callback structure
    // The email filtering is now handled differently in the v5 auth system
    console.log("Test skipped - NextAuth v5 compatibility");
  });
});
