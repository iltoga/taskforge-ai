import fs from "fs";
import path from "path";
import { CalendarTools } from "../tools/calendar-tools";
import { createToolRegistry } from "../tools/tool-registry";

// Mock the file system
jest.mock("fs");
jest.mock("path");

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe("Tool Registry Configuration", () => {
  let mockCalendarTools: jest.Mocked<CalendarTools>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CalendarTools
    mockCalendarTools = {
      getEvents: jest.fn(),
      searchEvents: jest.fn(),
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      deleteEvent: jest.fn(),
    } as unknown as jest.Mocked<CalendarTools>;

    // Mock path.resolve to return a predictable path
    mockPath.resolve.mockReturnValue(
      "/mock/settings/enabled-tools-categories.json"
    );
  });

  it("should load enabled tools from configuration file", () => {
    // Mock file exists and contains partial configuration
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        calendar: true,
        email: false,
        file: false,
        web: false,
      })
    );

    const registry = createToolRegistry(mockCalendarTools);

    // Should only have calendar tools
    const availableCategories = registry.getAvailableCategories();
    expect(availableCategories).toEqual(["calendar"]);

    const calendarTools = registry.getToolsByCategory("calendar");
    expect(calendarTools).toHaveLength(5); // 5 calendar tools
    expect(calendarTools.map((t) => t.name)).toEqual([
      "getEvents",
      "searchEvents",
      "createEvent",
      "updateEvent",
      "deleteEvent",
    ]);
  });

  it("should default to all enabled if config file does not exist", () => {
    // Mock file does not exist
    mockFs.existsSync.mockReturnValue(false);

    const registry = createToolRegistry(mockCalendarTools);

    // Should have calendar tools (only ones provided)
    const availableCategories = registry.getAvailableCategories();
    expect(availableCategories).toEqual(["calendar"]);

    const calendarTools = registry.getToolsByCategory("calendar");
    expect(calendarTools).toHaveLength(5);
  });

  it("should handle invalid JSON in config file gracefully", () => {
    // Mock file exists but contains invalid JSON
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error("Invalid JSON");
    });

    // Should not throw and default to all enabled
    const registry = createToolRegistry(mockCalendarTools);

    const availableCategories = registry.getAvailableCategories();
    expect(availableCategories).toEqual(["calendar"]);
  });

  it("should respect disabled calendar tools", () => {
    // Mock file exists and disables calendar tools
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        calendar: false,
        email: true,
        file: true,
        web: true,
      })
    );

    const registry = createToolRegistry(mockCalendarTools);

    // Should have no tools since calendar is disabled and others are not provided
    const availableCategories = registry.getAvailableCategories();
    expect(availableCategories).toEqual([]);

    const allTools = registry.getAvailableTools();
    expect(allTools).toHaveLength(0);
  });

  it("should handle partial tool providers with mixed configuration", () => {
    // Mock file exists with mixed configuration
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        calendar: true,
        email: false, // This will be ignored since emailTools is not provided
        file: true, // This will be ignored since fileTools is not provided
        web: false,
      })
    );

    const registry = createToolRegistry(mockCalendarTools); // Only calendar tools provided

    // Should only have calendar tools since that's the only provider given
    const availableCategories = registry.getAvailableCategories();
    expect(availableCategories).toEqual(["calendar"]);

    const calendarTools = registry.getToolsByCategory("calendar");
    expect(calendarTools).toHaveLength(5);
  });
});
