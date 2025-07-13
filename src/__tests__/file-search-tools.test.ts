import { FileSearchTool } from "@/services/file-search-service";
import { FileSearchTools } from "@/tools/file-search-tools";
import { ProcessedFile } from "@/types/files";

// Mock the FileSearchTool service
jest.mock("@/services/file-search-service");

describe("FileSearchTools", () => {
  let fileSearchTools: FileSearchTools;
  let mockFileSearchTool: jest.Mocked<FileSearchTool>;

  const mockFiles: ProcessedFile[] = [
    {
      name: "test.pdf",
      size: 1000,
      type: "application/pdf",
      isImage: false,
    },
    {
      name: "image.jpg",
      size: 500,
      type: "image/jpeg",
      isImage: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock FileSearchTool instance
    mockFileSearchTool = {
      initialize: jest.fn(),
      searchFiles: jest.fn(),
      cleanup: jest.fn(),
    } as any;

    // Mock the FileSearchTool constructor
    (
      FileSearchTool as jest.MockedClass<typeof FileSearchTool>
    ).mockImplementation(() => mockFileSearchTool);

    fileSearchTools = new FileSearchTools();
  });

  describe("initializeFileSearch", () => {
    it("should successfully initialize with files", async () => {
      mockFileSearchTool.initialize.mockResolvedValue(undefined);

      const result = await fileSearchTools.initializeFileSearch(mockFiles);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: "File search tool initialized successfully",
        fileCount: 2,
        documentFiles: 1,
        imageFiles: 1,
      });
      expect(mockFileSearchTool.initialize).toHaveBeenCalledWith(
        undefined,
        "gpt-4.1-mini",
        mockFiles
      );
    });

    it("should handle initialization errors", async () => {
      const errorMessage = "Initialization failed";
      mockFileSearchTool.initialize.mockRejectedValue(new Error(errorMessage));

      const result = await fileSearchTools.initializeFileSearch(mockFiles);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  describe("searchFiles", () => {
    beforeEach(async () => {
      mockFileSearchTool.initialize.mockResolvedValue(undefined);
      await fileSearchTools.initializeFileSearch(mockFiles);
    });

    it("should successfully search files", async () => {
      const mockResults = [
        {
          content: "Test content",
          filename: "test.pdf",
          relevance: 0.8,
          method: "file_search" as const,
        },
      ];
      mockFileSearchTool.searchFiles.mockResolvedValue(mockResults);

      const result = await fileSearchTools.searchFiles({
        query: "test query",
        maxResults: 5,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        query: "test query",
        results: mockResults,
        totalResults: 1,
        method: "file_search",
      });
      expect(mockFileSearchTool.searchFiles).toHaveBeenCalledWith("test query");
    });

    it("should limit results when maxResults is specified", async () => {
      const mockResults = [
        { content: "Result 1", method: "file_search" as const },
        { content: "Result 2", method: "file_search" as const },
        { content: "Result 3", method: "file_search" as const },
      ];
      mockFileSearchTool.searchFiles.mockResolvedValue(mockResults);

      const result = await fileSearchTools.searchFiles({
        query: "test query",
        maxResults: 2,
      });

      expect(result.success).toBe(true);
      expect(result.data?.results).toHaveLength(2);
      expect(result.data?.totalResults).toBe(3);
    });

    it("should handle search errors", async () => {
      const errorMessage = "Search failed";
      mockFileSearchTool.searchFiles.mockRejectedValue(new Error(errorMessage));

      const result = await fileSearchTools.searchFiles({
        query: "test query",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });

    it("should fail when not initialized", async () => {
      const uninitializedTools = new FileSearchTools();

      const result = await uninitializedTools.searchFiles({
        query: "test query",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "File search tool not initialized. Please upload files first."
      );
    });
  });

  describe("cleanupFiles", () => {
    beforeEach(async () => {
      mockFileSearchTool.initialize.mockResolvedValue(undefined);
      await fileSearchTools.initializeFileSearch(mockFiles);
    });

    it("should successfully cleanup files", async () => {
      mockFileSearchTool.cleanup.mockResolvedValue(undefined);

      const result = await fileSearchTools.cleanupFiles({
        deleteDiskFiles: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: "File search resources cleaned up successfully",
        deletedDiskFiles: true,
      });
      expect(mockFileSearchTool.cleanup).toHaveBeenCalledWith(true);
    });

    it("should handle cleanup errors", async () => {
      const errorMessage = "Cleanup failed";
      mockFileSearchTool.cleanup.mockRejectedValue(new Error(errorMessage));

      const result = await fileSearchTools.cleanupFiles();

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });

    it("should use default parameters when none provided", async () => {
      mockFileSearchTool.cleanup.mockResolvedValue(undefined);

      const result = await fileSearchTools.cleanupFiles();

      expect(result.success).toBe(true);
      expect(result.data?.deletedDiskFiles).toBe(false);
      expect(mockFileSearchTool.cleanup).toHaveBeenCalledWith(false);
    });
  });
});
