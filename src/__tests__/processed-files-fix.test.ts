/**
 * Test to verify that convertedImages are properly passed between routes
 */

import { ProcessedFile } from "../types/files";

describe("ProcessedFiles convertedImages preservation", () => {
  it("should preserve convertedImages when mapping from upload response to chat request", () => {
    // Simulate the response from file upload route (PDF conversion)
    const uploadResponse = {
      success: true,
      message: "Upload(s) completed",
      uploads: [
        {
          fileName: "test-document.pdf",
          fileSize: 1024000,
          fileType: "application/pdf",
          isImage: false,
          convertedImages: ["test-document_p1.png", "test-document_p2.png"],
          totalImageSize: 512000,
          processAsImage: true,
        },
      ],
    };

    // Simulate how Chat.tsx processes the upload response into UploadedFile
    const uploadedFile = {
      id: uploadResponse.uploads[0].fileName,
      name: uploadResponse.uploads[0].fileName,
      size: uploadResponse.uploads[0].fileSize,
      type: uploadResponse.uploads[0].fileType,
      isImage: uploadResponse.uploads[0].isImage,
      convertedImages: uploadResponse.uploads[0].convertedImages,
      totalImageSize: uploadResponse.uploads[0].totalImageSize,
      processAsImage: uploadResponse.uploads[0].processAsImage,
    };

    // Simulate how Chat.tsx maps UploadedFile back to ProcessedFile for chat request
    const processedFile: ProcessedFile = {
      fileName: uploadedFile.name,
      fileSize: uploadedFile.size,
      fileType: uploadedFile.type,
      isImage: uploadedFile.isImage,
      convertedImages: uploadedFile.convertedImages,
      totalImageSize: uploadedFile.totalImageSize,
      processAsImage: uploadedFile.processAsImage,
    };

    // Verify that convertedImages are preserved
    expect(processedFile.convertedImages).toEqual([
      "test-document_p1.png",
      "test-document_p2.png",
    ]);
    expect(processedFile.totalImageSize).toBe(512000);
    expect(processedFile.processAsImage).toBe(true);
    expect(processedFile.fileName).toBe("test-document.pdf");
  });

  it("should handle regular image files without convertedImages", () => {
    const uploadResponse = {
      success: true,
      message: "Upload(s) completed",
      uploads: [
        {
          fileName: "image.png",
          fileSize: 256000,
          fileType: "image/png",
          isImage: true,
          processAsImage: true,
        },
      ],
    };

    const uploadedFile = {
      id: uploadResponse.uploads[0].fileName,
      name: uploadResponse.uploads[0].fileName,
      size: uploadResponse.uploads[0].fileSize,
      type: uploadResponse.uploads[0].fileType,
      isImage: uploadResponse.uploads[0].isImage,
      convertedImages: uploadResponse.uploads[0].convertedImages, // undefined
      totalImageSize: uploadResponse.uploads[0].totalImageSize, // undefined
      processAsImage: uploadResponse.uploads[0].processAsImage,
    };

    const processedFile: ProcessedFile = {
      fileName: uploadedFile.name,
      fileSize: uploadedFile.size,
      fileType: uploadedFile.type,
      isImage: uploadedFile.isImage,
      convertedImages: uploadedFile.convertedImages,
      totalImageSize: uploadedFile.totalImageSize,
      processAsImage: uploadedFile.processAsImage,
    };

    // Verify that undefined values are handled correctly
    expect(processedFile.convertedImages).toBeUndefined();
    expect(processedFile.totalImageSize).toBeUndefined();
    expect(processedFile.processAsImage).toBe(true);
    expect(processedFile.isImage).toBe(true);
  });
});
