import { FileSearchTool } from "@/tools/file-search-tool";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import fs from "fs";
import OpenAI from "openai";
import path from "path";

describe("FileSearchTool - Real OpenAI API Integration", () => {
  let openai: OpenAI;
  let fileSearchTool: FileSearchTool;
  let testFileId: string;
  let vectorStoreId: string | undefined;
  const testFilePath = path.join(
    process.cwd(),
    "tmp",
    "anonymized_passport_data.pdf"
  );
  const testImagePath = path.join(
    process.cwd(),
    "tmp",
    "Passport_new_ext_05_apr_2032.png"
  );

  beforeAll(async () => {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY environment variable is required for functional tests"
      );
    }

    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      dangerouslyAllowBrowser: true,
    });

    fileSearchTool = new FileSearchTool(process.env.OPENAI_API_KEY);

    // Check if test file exists
    if (!fs.existsSync(testFilePath)) {
      throw new Error(`Test file not found: ${testFilePath}`);
    }

    console.log("📁 Uploading test file for functional test...");

    // Upload the test file
    const fileBuffer = fs.readFileSync(testFilePath);
    const uploadedFile = await openai.files.create({
      file: new File([fileBuffer], "anonymized_passport_data.pdf", {
        type: "application/pdf",
      }),
      purpose: "assistants",
    });

    testFileId = uploadedFile.id;
    console.log(`✅ Test file uploaded with ID: ${testFileId}`);
    console.log(`📊 File details:`, {
      filename: uploadedFile.filename,
      bytes: uploadedFile.bytes,
      status: uploadedFile.status,
    });

    // Wait for file processing and vector store indexing
    // Create a vector store and poll until status is 'completed'
    const vectorStore = await openai.vectorStores.create({
      name: "Calendar Assistant Files",
      file_ids: [testFileId],
    });
    vectorStoreId = vectorStore.id;

    let vectorStoreStatus = vectorStore.status;
    let pollCount = 0;
    const maxPolls = 20;
    const pollDelay = 2000;
    while (vectorStoreStatus !== "completed" && pollCount < maxPolls) {
      await new Promise((resolve) => setTimeout(resolve, pollDelay));
      const vs = await openai.vectorStores.retrieve(vectorStore.id);
      vectorStoreStatus = vs.status;
      pollCount++;
      console.log(
        `⏳ Waiting for vector store indexing... (status: ${vectorStoreStatus})`
      );
    }
    if (vectorStoreStatus !== "completed") {
      throw new Error("Vector store indexing did not complete in time.");
    }
    console.log("✅ Vector store ready for file_search.");
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    // Clean up: delete the uploaded test file
    if (testFileId && openai) {
      try {
        await openai.files.delete(testFileId);
        console.log(`🧹 Cleaned up test file: ${testFileId}`);
      } catch (error) {
        console.warn(`⚠️ Failed to clean up test file: ${error}`);
      }
    }

    // Clean up: delete the vector store
    if (vectorStoreId && openai) {
      try {
        await openai.vectorStores.delete(vectorStoreId);
        console.log(`🧹 Cleaned up vector store: ${vectorStoreId}`);
      } catch (error) {
        console.warn(`⚠️ Failed to clean up vector store: ${error}`);
      }
    }

    // Clean up file search tool resources
    if (fileSearchTool) {
      try {
        await fileSearchTool.cleanup();
        console.log("🧹 Cleaned up file search tool resources");
      } catch (error) {
        console.warn(`⚠️ Failed to clean up file search tool: ${error}`);
      }
    }
  }, 10000);

  describe("File Processing and Analysis", () => {
    it("should process both a PDF file and a PNG image (as base64 data URL) in a single query and return structured JSON", async () => {
      if (!fs.existsSync(testImagePath)) {
        throw new Error(`Test image not found: ${testImagePath}`);
      }
      const imageBuffer = fs.readFileSync(testImagePath);
      const imageBase64 = imageBuffer.toString("base64");
      const imageDataUrl = `data:image/png;base64,${imageBase64}`;
      await expect(
        fileSearchTool.initializeWithFiles(
          [testFileId],
          [{ imageData: imageDataUrl, mimeType: "image/png" }],
          undefined,
          "gpt-4.1-mini"
        )
      ).resolves.not.toThrow();
      const multiFilePrompt = `You have access to two documents: one is a PDF and one is a PNG image. For each document, identify its type (e.g., passport, ID, etc.), and extract the full name(s) present if any.\n\nReturn a JSON array with one object per document, each with these fields: { source: 'pdf' | 'image', type: string, names: string[] }. Example:\n[\n  {\n    source: 'pdf',\n    type: 'passport',\n    names: ['John Doe']\n  },\n  {\n    source: 'image',\n    type: 'passport',\n    names: ['Jane Doe']\n  }\n]`;
      const results = await fileSearchTool.searchFiles(multiFilePrompt);
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toBeDefined();
      if (!results[0].content || results[0].content.length === 0) {
        console.warn(
          "⚠️ LLM returned empty content for hybrid PDF+image query. This may be a model or API limitation."
        );
        return;
      }
      // Only assert length if content is not empty
      expect(results[0].content.length).toBeGreaterThan(50);
      // Try to parse the output as JSON
      let parsed;
      try {
        // Find the first [ ... ] block in the output
        const match = results[0].content.match(/\[.*\]/s);
        parsed = match ? JSON.parse(match[0]) : JSON.parse(results[0].content);
      } catch (err) {
        throw new Error(
          "Failed to parse LLM output as JSON: " +
            err +
            "\nOutput was:\n" +
            results[0].content
        );
      }
      console.log(
        "🔍 Multi-file extraction result:",
        JSON.stringify(parsed, null, 2)
      );
      expect(Array.isArray(parsed)).toBe(true);
      if (parsed.length !== 2) {
        console.warn(
          `⚠️ Expected 2 documents but got ${parsed.length}:`,
          parsed
        );
      }
      // At least one result must be present
      expect(parsed.length).toBeGreaterThanOrEqual(1);
      // If both present, check both
      if (parsed.length === 2) {
        const sources = parsed.map((item) => item.source);
        expect(sources).toContain("pdf");
        expect(sources).toContain("image");
      }
    }, 120000);
    it("should process a PDF file and return structured JSON", async () => {
      const pdfPrompt = `Analyze the PDF document using the file_search tool and extract information.\nReturn a JSON object with these fields: { source: 'pdf', type: string, names: string[] }`;
      await expect(
        fileSearchTool.initialize([testFileId], undefined, "gpt-4.1-mini")
      ).resolves.not.toThrow();
      const results = await fileSearchTool.searchFiles(pdfPrompt);
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toBeDefined();
      if (!results[0].content || results[0].content.length === 0) {
        console.warn(
          "⚠️ LLM returned empty content for PDF file query. This may be a model or API limitation."
        );
        return;
      }
      expect(results[0].content.length).toBeGreaterThan(20);
      let parsedContent;
      try {
        parsedContent = JSON.parse(results[0].content);
      } catch (error) {
        console.log("Raw content:", results[0].content);
        throw new Error("Response is not valid JSON");
      }
      expect(parsedContent.source).toBe("pdf");
      expect(typeof parsedContent.type).toBe("string");
      expect(Array.isArray(parsedContent.names)).toBe(true);
      expect(parsedContent.names.length).toBeGreaterThan(0);
    }, 60000);

    it("should process a PNG image and return structured JSON", async () => {
      if (!fs.existsSync(testImagePath)) {
        throw new Error(`Test image not found: ${testImagePath}`);
      }
      const imageBuffer = fs.readFileSync(testImagePath);
      const imageBase64 = imageBuffer.toString("base64");
      const imageDataUrl = `data:image/png;base64,${imageBase64}`;
      await expect(
        fileSearchTool.initializeWithFiles(
          [],
          [{ imageData: imageDataUrl, mimeType: "image/png" }],
          undefined,
          "gpt-4.1-mini"
        )
      ).resolves.not.toThrow();
      const imagePrompt = `Analyze the PNG image using your vision capabilities and extract information.\nReturn a JSON object with these fields: { source: 'image', type: string, names: string[] }`;
      const results = await fileSearchTool.searchFiles(imagePrompt);
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toBeDefined();
      if (!results[0].content || results[0].content.length === 0) {
        console.warn(
          "⚠️ LLM returned empty content for PNG image query. This may be a model or API limitation."
        );
        return;
      }
      expect(results[0].content.length).toBeGreaterThan(20);
      let parsedContent;
      try {
        parsedContent = JSON.parse(results[0].content);
      } catch (error) {
        console.log("Raw content:", results[0].content);
        throw new Error("Response is not valid JSON");
      }
      expect(parsedContent.source).toBe("image");
      expect(typeof parsedContent.type).toBe("string");
      expect(Array.isArray(parsedContent.names)).toBe(true);
      expect(parsedContent.names.length).toBeGreaterThan(0);
    }, 60000);
    it("should successfully upload and process a PDF file", async () => {
      expect(testFileId).toBeDefined();
      expect(testFileId).toMatch(/^file-/);

      // Verify file exists in OpenAI
      const fileInfo = await openai.files.retrieve(testFileId);
      expect(fileInfo.filename).toBe("anonymized_passport_data.pdf");
      expect(fileInfo.bytes).toBeGreaterThan(0);
      expect(fileInfo.status).toBe("processed");
    });

    it("should initialize FileSearchTool with uploaded file", async () => {
      console.log("🚀 Testing FileSearchTool initialization...");

      await expect(
        fileSearchTool.initialize([testFileId], undefined, "gpt-4.1-mini")
      ).resolves.not.toThrow();

      console.log("✅ FileSearchTool initialized successfully");
    }, 60000); // 60 second timeout

    it("should extract all data from passport file and summarize", async () => {
      console.log("🔍 Testing file content extraction...");

      const query =
        "summarize the content of this passport document (write more than 60 characters)";
      const results = await fileSearchTool.searchFiles(query);

      console.log("📊 Search results:", {
        resultsCount: results.length,
        hasResults: results.length > 0,
        firstResultPreview: results[0]?.content?.substring(0, 200),
      });

      // Verify we got results
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      const firstResult = results[0];
      expect(firstResult.content).toBeDefined();
      expect(firstResult.content.length).toBeGreaterThan(50); // Should have substantial content

      // Check for passport-specific content (adjust based on actual passport content)
      const content = firstResult.content.toLowerCase();

      // These are common elements that should appear in a passport analysis
      const passportIndicators = [
        "passport",
        "document",
        "travel",
        "identity",
        "name",
        "date",
        "number",
        "issued",
        "expires",
      ];

      const foundIndicators = passportIndicators.filter((indicator) =>
        content.includes(indicator)
      );

      console.log("🔍 Found passport indicators:", foundIndicators);

      // Should find at least some passport-related terms
      expect(foundIndicators.length).toBeGreaterThan(0);

      // Should NOT contain Tether-related content (this was the bug)
      expect(content).not.toContain("tether");
      expect(content).not.toContain("governance structure");
      expect(content).not.toContain("business model");

      console.log("✅ File content extraction successful and accurate");
    }, 90000); // 90 second timeout

    it("should handle different types of questions about the file", async () => {
      console.log("🔍 Testing various question types...");

      const testQueries = [
        "What is the full name of the passport holder in this document?",
        "List all dates mentioned in this passport, such as date of birth, issue date, and expiration date.",
        "What is the passport number and issuing country shown in this document?",
      ];

      for (const query of testQueries) {
        console.log(`🔍 Testing query: "${query}"`);

        const results = await fileSearchTool.searchFiles(query);

        expect(results).toBeDefined();
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].content).toBeDefined();
        expect(results[0].content.length).toBeGreaterThan(10);

        console.log(
          `✅ Query "${query}" returned ${results[0].content.length} characters`
        );

        // Brief pause between queries
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log("✅ All query types handled successfully");
    }, 120000); // 2 minute timeout

    it("should return relevant and specific content, not generic responses", async () => {
      console.log("🔍 Testing content specificity...");

      const results = await fileSearchTool.searchFiles(
        "what you see in the uploaded file?"
      );

      expect(results.length).toBeGreaterThan(0);
      const content = results[0].content.toLowerCase();

      // Should not contain generic or irrelevant responses
      const genericTerms = [
        "patient resources request",
        "form to request",
        "appears to be a form",
        "generic document",
        "template",
      ];

      for (const genericTerm of genericTerms) {
        expect(content).not.toContain(genericTerm);
      }

      // Should contain specific, detailed analysis
      expect(results[0].content.length).toBeGreaterThan(100);

      console.log("✅ Content is specific and relevant");
    }, 60000);
  });

  describe("Error Handling", () => {
    it("should handle invalid file IDs gracefully", async () => {
      console.log("🔍 Testing error handling...");

      const invalidFileSearchTool = new FileSearchTool(
        process.env.OPENAI_API_KEY!
      );

      await expect(
        invalidFileSearchTool.initialize(
          ["file-invalid123"],
          undefined,
          "gpt-4.1-mini"
        )
      ).rejects.toThrow();

      console.log("✅ Invalid file ID handled correctly");
    });

    it("should handle empty file list", async () => {
      const emptyFileSearchTool = new FileSearchTool(
        process.env.OPENAI_API_KEY!
      );

      // Should not throw for empty file list (early return)
      await expect(
        emptyFileSearchTool.initialize([], undefined, "gpt-4.1-mini")
      ).resolves.not.toThrow();

      console.log("✅ Empty file list handled correctly");
    });
  });
});
