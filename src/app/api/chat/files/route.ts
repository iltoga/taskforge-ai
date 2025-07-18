/**
 * @openapi
 * /api/chat/files:
 *   post:
 *     summary: "Upload and process files for chat"
 *     description: |
 *       Uploads and processes files (PDF, images, documents) for use in chat conversations. Files are converted to appropriate formats and uploaded to OpenAI for processing.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "File to upload (max 4MB)"
 *             required:
 *               - file
 *     responses:
 *       200:
 *         description: "Files processed successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 uploads:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: "File validation error"
 *       401:
 *         description: "Authentication required"
 *       413:
 *         description: "File too large"
 *       500:
 *         description: "File processing failed"
 *   delete:
 *     summary: "Delete processed files"
 *     description: |
 *       Deletes all processed files for the authenticated user from both local storage and OpenAI.
 *     responses:
 *       200:
 *         description: "Files deleted successfully"
 *       401:
 *         description: "Authentication required"
 *       500:
 *         description: "Failed to delete files"
 */
import { auth } from "@/lib/auth-compat";
import { AIProviderConfig } from "@/lib/openai";
import { PdfConverter } from "@/services/pdf-converter";
import { ApiResponse, ProcessedFile } from "@/types/files";
import fs from "fs";
import { lookup as mimeLookup } from "mime-types";
import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "4194304", 10); // 4 MB
const FILE_UPLOAD_DIR = process.env.FILE_UPLOAD_DIR || "/app/tmp_data";

// File upload and deletion must use OpenAI REST API directly (not SDK). Below is a minimal REST implementation for deletion.
async function deleteOpenAIFile(
  fileId: string,
  apiKey: string,
  baseURL?: string
): Promise<void> {
  const url = `${baseURL || "https://api.openai.com/v1"}/files/${fileId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI file deletion failed: ${err}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized", uploads: [] } as ApiResponse,
        { status: 401 }
      );
    }

    // Parse form data to get the uploaded file
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "No file provided",
          uploads: [],
        } as ApiResponse,
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      const msg = `File too large. Max size is ${MAX_FILE_SIZE} bytes`;
      return NextResponse.json(
        { success: false, message: msg, uploads: [] } as ApiResponse,
        { status: 413, headers: { "X-Max-File-Size": String(MAX_FILE_SIZE) } }
      );
    }

    // Validate & normalise MIME type
    const mimeType = file.type || mimeLookup(file.name) || "";
    const lowerName = file.name.toLowerCase();

    // Transcode HEIC images to JPEG for Vision support
    if (
      (mimeType === "image/heic" || lowerName.endsWith(".heic")) &&
      file.size <= MAX_FILE_SIZE
    ) {
      // sharp is not available in this environment; throw a clear error
      throw new Error(
        "HEIC image conversion is not supported in this environment. Please upload JPEG/PNG/WebP images."
      );
    }

    const IMAGE_MIME_ALLOW = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/bmp",
      "image/tiff",
    ];

    // Add processed array to collect all processed files
    const processed: ProcessedFile[] = [];

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const isImage = IMAGE_MIME_ALLOW.includes(mimeType);

    if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
      // ── Convert PDF pages → PNG buffers and encode as base64 for vision
      console.log(`📄 Converting PDF ${file.name} to PNG images for vision`);

      try {
        const pages = await PdfConverter.convertToImages(buffer);

        console.log(`📄 Successfully converted ${pages.length} pages`);

        // For multi-page PDFs, create a single ProcessedFile entry with all image file names and total size
        const imageFileNames: string[] = [];
        let totalImageSize = 0;

        for (const page of pages) {
          const pageFileName = `${file.name.replace(/\.pdf$/i, "")}_p${
            page.pageNumber
          }.png`;
          const pageFilePath = `${FILE_UPLOAD_DIR}/${pageFileName}`;
          fs.writeFileSync(pageFilePath, page.buffer);
          imageFileNames.push(pageFileName);
          totalImageSize += page.buffer.length;
        }

        // Optionally, save the original PDF as well
        fs.writeFileSync(`${FILE_UPLOAD_DIR}/${file.name}`, buffer);

        processed.push({
          name: file.name,
          size: file.size,
          type: file.type,
          isImage: false,
          convertedImages: imageFileNames,
          totalImageSize,
          processAsImage: imageFileNames.length > 0,
        });

        if (processed.length === 0) {
          throw new Error("No pages were successfully converted from PDF");
        }
      } catch (conversionError) {
        console.error("💥 PDF conversion failed:", conversionError);
        const errorMessage =
          conversionError instanceof Error
            ? conversionError.message
            : "PDF conversion failed";
        return NextResponse.json(
          {
            success: false,
            message: `PDF conversion failed: ${errorMessage}`,
            uploads: [],
          } as ApiResponse,
          { status: 500 }
        );
      }
    } else if (isImage) {
      try {
        // try to save the image buffer as a binary file (with overwrite). leave the file name as is
        const filePath = `${FILE_UPLOAD_DIR}/${file.name}`;
        fs.writeFileSync(filePath, buffer);
        processed.push({
          name: file.name,
          size: file.size,
          type: file.type,
          isImage: true,
          processAsImage: true,
        });
      } catch (err) {
        console.error("Image encoding error:", err);
        const msg =
          err instanceof Error ? err.message : "Failed to encode image";
        return NextResponse.json(
          { success: false, message: msg, uploads: [] } as ApiResponse,
          { status: 500 }
        );
      }
    } else {
      // ── Regular non-image, non-PDF documents - upload to OpenAI for file search
      if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
        // PDF files are already handled above (converted to images), do not upload
        // Log that PDF files are skipped for upload since they are converted to images
        console.log(
          `PDF file "${file.name}" is not uploaded directly; converted to images for vision processing.`
        );
      } else {
        // Save the file as a binary file (with overwrite)
        const filePath = `${FILE_UPLOAD_DIR}/${file.name}`;
        fs.writeFileSync(filePath, buffer);
        processed.push({
          name: file.name,
          size: file.size,
          type: file.type,
          isImage: false,
          processAsImage: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Upload(s) completed",
      uploads: processed,
    } as ApiResponse);
  } catch (error: unknown) {
    console.error("File upload error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json(
      { success: false, message, uploads: [] } as ApiResponse,
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
          error: "Unauthorized",
          uploads: [],
        } as ApiResponse,
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        {
          success: false,
          message: "No file ID provided",
          error: "No file ID provided",
          uploads: [],
        } as ApiResponse,
        { status: 400 }
      );
    }

    try {
      // Only OpenAI supports file deletion for uploaded files
      const providerConfig: AIProviderConfig = {
        provider:
          process.env.OPENAI_PROVIDER === "openrouter"
            ? "openrouter"
            : "openai",
        apiKey: process.env.OPENAI_API_KEY!,
        baseURL: process.env.OPENAI_BASE_URL,
      };
      if (providerConfig.provider !== "openai") {
        throw new Error(
          "File deletion is only supported for OpenAI uploaded files."
        );
      }
      await deleteOpenAIFile(
        fileId,
        providerConfig.apiKey,
        providerConfig.baseURL
      );
      return NextResponse.json({
        success: true,
        message: "File deleted successfully",
        uploads: [],
      } as ApiResponse);
    } catch (deleteError: unknown) {
      console.error("File deletion error:", deleteError);
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete file";
      return NextResponse.json(
        { success: false, message, error: message, uploads: [] } as ApiResponse,
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("File deletion error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete file";
    return NextResponse.json(
      { success: false, message, error: message, uploads: [] } as ApiResponse,
      { status: 500 }
    );
  }
}
