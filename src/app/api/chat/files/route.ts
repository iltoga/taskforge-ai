import { authOptions } from "@/lib/auth";
import { AIProviderConfig } from "@/lib/openai";
import { PdfConverter } from "@/services/pdf-converter";
import { ApiResponse, ProcessedFile } from "@/types/files";
import { lookup as mimeLookup } from "mime-types";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";

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
    const session = await getServerSession(authOptions);
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

        // Convert each page to base64 for vision instead of uploading
        for (const page of pages) {
          const pageFileName = `${file.name.replace(/\.pdf$/i, "")}_p${
            page.pageNumber
          }.png`;
          // Try to save the page buffer as a binary file (with overwrite)
          const pageFilePath = `${FILE_UPLOAD_DIR}/${pageFileName}`;
          fs.writeFileSync(pageFilePath, page.buffer);

          processed.push({
            fileName: pageFileName,
            fileSize: page.buffer.length,
            fileType: "image/png",
            isImage: true,
          });
        }

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
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          isImage: true,
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
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          isImage: false,
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
    const session = await getServerSession(authOptions);
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
