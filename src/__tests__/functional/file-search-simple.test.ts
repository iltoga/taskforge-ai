import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import fs from "fs";
import OpenAI from "openai";
import path from "path";
import { FileSearchTool } from "../../services/file-search-tool";

describe("FileSearchTool - Simple Test", () => {
  let openai: OpenAI;
  let fileSearchTool: FileSearchTool;
  let testFileId: string;
  const testFilePath = path.join(
    process.cwd(),
    "tmp",
    "Passport_new_ext_05_apr_2032.pdf"
  );

  beforeAll(async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      dangerouslyAllowBrowser: true,
    });
    fileSearchTool = new FileSearchTool(process.env.OPENAI_API_KEY);

    if (!fs.existsSync(testFilePath)) {
      throw new Error(`Test file not found: ${testFilePath}`);
    }

    // Upload test file
    const fileBuffer = fs.readFileSync(testFilePath);
    const uploadedFile = await openai.files.create({
      file: new File([fileBuffer], "Passport_new_ext_05_apr_2032.pdf", {
        type: "application/pdf",
      }),
      purpose: "assistants",
    });

    testFileId = uploadedFile.id;
    console.log(`✅ Test file uploaded: ${testFileId}`);
  }, 15000);

  afterAll(async () => {
    if (testFileId && openai) {
      try {
        await openai.files.delete(testFileId);
        console.log(`🧹 Cleaned up: ${testFileId}`);
      } catch (error) {
        console.warn(`⚠️ Cleanup failed: ${error}`);
      }
    }

    if (fileSearchTool) {
      try {
        await fileSearchTool.cleanup();
      } catch (error) {
        console.warn(`⚠️ FileSearchTool cleanup failed: ${error}`);
      }
    }
  }, 5000);

  it("should initialize and detect failed file processing", async () => {
    console.log("🚀 Testing FileSearchTool initialization...");

    // This should complete without hanging
    await fileSearchTool.initialize([testFileId], undefined, "gpt-5-mini");

    console.log("✅ Initialization completed");

    // Now try to search - this should detect the failed file and fall back to vision
    console.log("🔍 Testing search with fallback...");

    const results = await fileSearchTool.searchFiles(
      "extract all data from the file and summarize them"
    );

    console.log("📊 Results:", {
      count: results.length,
      method: results[0]?.method,
      contentLength: results[0]?.content?.length,
      preview: results[0]?.content?.substring(0, 200),
    });

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);

    // Should have either successfully processed via file_search OR fallen back to vision_api
    expect(["file_search", "vision_api"]).toContain(results[0].method);

    // Should contain actual content, not generic responses
    expect(results[0].content.length).toBeGreaterThan(50);

    // Should NOT contain Tether content (the previous bug)
    const content = results[0].content.toLowerCase();
    expect(content).not.toContain("tether");
    expect(content).not.toContain("governance structure");

    console.log("✅ Test completed successfully!");
  }, 60000); // 1 minute max
});
