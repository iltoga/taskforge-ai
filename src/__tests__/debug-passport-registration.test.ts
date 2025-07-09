import { CalendarTools } from "../tools/calendar-tools";
import { EmailTools } from "../tools/email-tools";
import { PassportTools } from "../tools/passport-tools";
import { createToolRegistry } from "../tools/tool-registry";

describe("Debug Passport Tools Registration", () => {
  it("should register passport tools correctly", async () => {
    console.log("Testing tool registry...");

    // Create mock calendar tools
    const mockCalendarTools = {
      getEvents: jest.fn().mockResolvedValue({ success: true, data: [] }),
    } as unknown as CalendarTools;

    const emailTools = new EmailTools();
    const passportTools = new PassportTools();

    console.log("PassportTools instance created:", !!passportTools);

    // Create tool registry
    const toolRegistry = createToolRegistry(
      mockCalendarTools,
      emailTools,
      undefined,
      passportTools
    );

    // Check available categories
    const categories = toolRegistry.getAvailableCategories();
    console.log("Available categories:", categories);

    // Check all tools
    const allTools = toolRegistry.getAvailableTools();
    console.log("All available tools:");
    allTools.forEach((tool) => {
      console.log(`  ${tool.category}:${tool.name} - ${tool.description}`);
    });

    // Check passport tools specifically
    const passportToolsList = toolRegistry.getToolsByCategory("passport");
    console.log("Passport tools count:", passportToolsList.length);

    // This should not be empty if registration works
    expect(passportToolsList.length).toBeGreaterThan(0);

    // Check if specific passport tools are available
    const toolNames = allTools.map((tool) => tool.name);
    console.log("Available tool names:", toolNames);

    expect(toolNames).toContain("listPassports");
    expect(toolNames).toContain("createPassport");
    expect(toolNames).toContain("getPassports");
    expect(toolNames).toContain("updatePassport");
    expect(toolNames).toContain("deletePassport");
  });
});
