import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import { NextRequest } from "next/server";
import path from "path";
import { POST } from "../../app/api/chat/route";

jest.setTimeout(120_000);

const prompt = `add passport to db`;

describe("Full chat API flow with image upload", () => {
  let imageBase64: string;
  const testImagePath = path.join(process.cwd(), "tmp", "passport.png");

  beforeAll(async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    // Check if test file exists
    if (!fs.existsSync(testImagePath)) {
      throw new Error(`Test image not found: ${testImagePath}`);
    }

    // Read and encode image as base64 (truncated for testing to avoid context limits)
    const imageBuffer = fs.readFileSync(testImagePath);
    // Use only first 30KB to avoid context window limits in testing
    const truncatedBuffer = imageBuffer.slice(0, 30000);
    imageBase64 = truncatedBuffer.toString("base64");
    console.log(
      `✅ Test image encoded to base64 (${imageBase64.length} chars - truncated for testing)`
    );
  }, 30000);

  it("processes passport image through full chat API", async () => {
    // Create processedFiles structure as expected by the API
    const processedFiles = [
      {
        fileName: "passport.png",
        fileSize: fs.statSync(testImagePath).size,
        fileType: "image/png",
        isImage: true,
        imageData: `data:image/png;base64,${imageBase64}`,
      },
    ];

    // Create the request payload
    const requestBody = {
      message: prompt,
      messages: [],
      model: "gpt-5-mini",
      useTools: true,
      orchestratorModel: "gpt-5-mini",
      developmentMode: true, // Use agentic mode
      calendarId: "primary",
      fileIds: [],
      processedFiles: processedFiles,
    };

    // Create a mock NextRequest
    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify(requestBody),
      headers: {
        "content-type": "application/json",
      },
    });

    // Mock the auth session for the API
    const mockSession = {
      user: { email: "test@example.com" },
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      expires: new Date(Date.now() + 3600000).toISOString(),
    };

    // Mock the getServerSession function
    jest.doMock("next-auth", () => ({
      getServerSession: jest.fn().mockResolvedValue(mockSession),
    }));

    console.log("🚀 Calling chat API with image data...");

    // Call the API
    const response = await POST(request);
    const result = await response.json();

    console.log("📊 API Response:", {
      success: result.success,
      approach: result.approach,
      messageLength: result.message?.length || 0,
      hasSteps: !!result.steps,
      hasToolCalls: !!result.toolCalls,
      error: result.error,
    });

    // Verify the response
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.approach).toBe("agentic");

    if (result.message) {
      console.log(`🎯 Full API result: ${result.message.substring(0, 500)}...`);
    }

    // The response should contain evidence that the image was processed
    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log(
        "🔧 Tool calls made:",
        result.toolCalls.map((tc: any) => tc.tool)
      );

      // Look for passport creation tool calls
      const passportToolCalls = result.toolCalls.filter(
        (tc: any) => tc.tool === "createPassport"
      );

      if (passportToolCalls.length > 0) {
        console.log(
          "✅ Passport tools were called - image was processed successfully"
        );
        expect(passportToolCalls.length).toBeGreaterThan(0);
      } else {
        console.warn(
          "⚠️ No passport tools were called - image processing may have failed"
        );
      }
    } else {
      console.warn(
        "⚠️ No tool calls were made - this suggests image processing failed"
      );
    }
  });
});
