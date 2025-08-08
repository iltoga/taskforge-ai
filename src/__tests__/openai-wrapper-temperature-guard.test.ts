import { jest } from "@jest/globals";

// Mock the 'ai' package's generateText to capture arguments
const generateTextMock = jest.fn(async (args: unknown) => ({
  text: "ok",
  raw: { args },
}));
jest.unstable_mockModule("ai", () => ({
  generateText: (args: unknown) => generateTextMock(args),
}));

// Import after mocks
const { generateTextWithProvider } = await import("@/lib/openai");

describe("generateTextWithProvider temperature/sampling guard", () => {
  beforeEach(() => {
    generateTextMock.mockClear();
  });

  it("strips temperature for gpt-5-mini (unsupported)", async () => {
    await generateTextWithProvider(
      "hello",
      { provider: "openai", apiKey: "test" },
      { model: "gpt-5-mini", temperature: 0.7 }
    );

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const callArg = generateTextMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    // Ensure sampling params are not present
    expect("temperature" in callArg).toBe(false);
    expect("top_p" in callArg).toBe(false);
    expect("frequency_penalty" in callArg).toBe(false);
    expect("presence_penalty" in callArg).toBe(false);
  });
});
