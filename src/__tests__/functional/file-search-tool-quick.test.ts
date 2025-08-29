import fs from "fs";
import OpenAI from "openai";
import path from "path";
import { FileSearchTools } from "../../tools/file-search-tools";

describe("FileSearchTools - Quick TDD Test", () => {
  let fileSearchTool: FileSearchTools;
  let openai: OpenAI;
  let uploadedFileId: string | null = null;

  beforeAll(() => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable is required for functional tests"
      );
    }

    fileSearchTool = new FileSearchTools();
    openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  });

  afterAll(async () => {
    // Cleanup uploaded file
    if (uploadedFileId) {
      try {
        await openai.files.delete(uploadedFileId);
        console.log(`✅ Cleaned up test file: ${uploadedFileId}`);
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup file ${uploadedFileId}:`, error);
      }
    }

    // Cleanup file search tool resources
    try {
      await fileSearchTool.cleanup();
    } catch (error) {
      console.warn("⚠️ Failed to cleanup file search tool:", error);
    }
  }, 30000);

  it("should upload passport file and extract basic data", async () => {
    // Step 1: Check if passport file exists
    const passportPath = path.join(
      process.cwd(),
      "tmp",
      "Passport_new_ext_05_apr_2032.pdf"
    );
    console.log(`🔍 Looking for passport file at: ${passportPath}`);

    if (!fs.existsSync(passportPath)) {
      console.warn(
        `⚠️ Passport file not found at ${passportPath}, skipping test`
      );
      return;
    }

    // Step 2: Upload file to OpenAI
    console.log("📁 Uploading passport file to OpenAI...");
    const fileBuffer = fs.readFileSync(passportPath);
    const file = new File([fileBuffer], "Passport_new_ext_05_apr_2032.pdf", {
      type: "application/pdf",
    });

    const uploadResponse = await openai.files.create({
      file: file,
      purpose: "assistants",
    });

    uploadedFileId = uploadResponse.id;
    console.log(`✅ File uploaded with ID: ${uploadedFileId}`);

    // Verify file upload
    expect(uploadResponse.id).toBeDefined();
    expect(uploadResponse.filename).toContain("Passport");
    expect(uploadResponse.bytes).toBeGreaterThan(0);

    // Step 3: Initialize FileSearchTool
    console.log("🚀 Initializing FileSearchTool...");
    const processedFiles = [
      {
        name: uploadedFileId,
        size: 548, // From the upload response
        type: "application/pdf",
        isImage: false,
        processAsImage: false,
        convertedImages: [],
      },
    ];

    const initResult = await fileSearchTool.initializeFileSearch(
      processedFiles,
      "gpt-5-mini"
    );

    expect(initResult.success).toBe(true);

    // Step 4: Test file search with data extraction query
    console.log("🔍 Testing data extraction...");
    const searchResult = await fileSearchTool.searchFiles({
      query: "extract all data from the file and summarize them",
    });

    // Step 5: Validate results
    expect(searchResult.success).toBe(true);
    expect(searchResult.data).toBeDefined();

    const data = searchResult.data as {
      results: any[];
      query: string;
      method: string;
    };
    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);

    const firstResult = data.results[0];
    expect(firstResult.content).toBeDefined();
    expect(firstResult.content.length).toBeGreaterThan(50); // Should have substantial content

    // Check for passport-specific content (not generic hallucination)
    const content = firstResult.content.toLowerCase();
    const hasPassportKeywords =
      content.includes("passport") ||
      content.includes("nationality") ||
      content.includes("date of birth") ||
      content.includes("place of birth") ||
      content.includes("issued") ||
      content.includes("expires");

    // Should NOT contain unrelated content
    const hasTetherContent =
      content.includes("tether") ||
      content.includes("governance") ||
      content.includes("business model");

    const hasPatientContent =
      content.includes("patient resources") || content.includes("medical");

    console.log("📊 Content Analysis:", {
      contentLength: firstResult.content.length,
      hasPassportKeywords,
      hasTetherContent,
      hasPatientContent,
      contentPreview: firstResult.content.substring(0, 200),
    });

    // Assertions
    expect(hasPassportKeywords).toBe(true); // Should contain passport-related content
    expect(hasTetherContent).toBe(false); // Should NOT contain Tether content
    expect(hasPatientContent).toBe(false); // Should NOT contain patient content

    console.log(
      "✅ Test passed - FileSearchTool correctly extracted passport data"
    );
  }, 120000); // 2 minute timeout - much more reasonable
});
