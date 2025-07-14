/**
 * Test to verify that categorizeFile function works with different file path formats
 * and handles converted images properly.
 */

import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { categorizeFile } from "../tools/file-search-tools";

config(); // Load .env

describe("categorizeFile path resolution fix", () => {
  const FILE_UPLOAD_DIR = process.env.FILE_UPLOAD_DIR || "/app/tmp_data";
  const testImagePath = "test_passport.png";
  const testPdfName = "test_passport.pdf";
  const convertedImageName = "test_passport_p1.png";

  beforeEach(() => {
    // Ensure test directory exists
    const uploadDir = path.join(process.cwd(), FILE_UPLOAD_DIR);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    const uploadDir = path.join(process.cwd(), FILE_UPLOAD_DIR);
    [testImagePath, convertedImageName].forEach((fileName) => {
      const filePath = path.join(uploadDir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  it("should handle filename-only input and find converted images", async () => {
    // Create a test converted image file
    const uploadDir = path.join(process.cwd(), FILE_UPLOAD_DIR);
    const convertedImagePath = path.join(uploadDir, convertedImageName);

    // Copy a real passport image for testing (if available)
    const sourceImagePath = path.join(
      process.cwd(),
      "tmp",
      "Passport_new_ext_05_apr_2032_p1.png"
    );
    if (fs.existsSync(sourceImagePath)) {
      fs.copyFileSync(sourceImagePath, convertedImagePath);

      // Test categorizing with just the PDF filename - should find the converted PNG
      const category = await categorizeFile(testPdfName);
      expect(typeof category).toBe("string");
      expect(category).toBe("passport");
    } else {
      // If test image doesn't exist, test the error handling
      await expect(categorizeFile(testPdfName)).rejects.toThrow(
        "File not found"
      );
    }
  });

  it("should handle absolute paths correctly", async () => {
    const uploadDir = path.join(process.cwd(), FILE_UPLOAD_DIR);
    const testImageFullPath = path.join(uploadDir, testImagePath);

    // Copy a real passport image for testing (if available)
    const sourceImagePath = path.join(
      process.cwd(),
      "tmp",
      "Passport_new_ext_05_apr_2032_p1.png"
    );
    if (fs.existsSync(sourceImagePath)) {
      fs.copyFileSync(sourceImagePath, testImageFullPath);

      // Test categorizing with full path
      const category = await categorizeFile(testImageFullPath);
      expect(typeof category).toBe("string");
      expect(category).toBe("passport");
    } else {
      // Skip this test if source image is not available
      console.log(
        "Source test image not available, skipping absolute path test"
      );
    }
  });

  it("should throw proper error when file doesn't exist", async () => {
    const nonExistentFile = "non_existent_file.pdf";

    await expect(categorizeFile(nonExistentFile)).rejects.toThrow(
      "File not found"
    );
  });
});
