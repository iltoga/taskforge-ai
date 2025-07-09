import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

const FILE_UPLOAD_DIR = process.env.FILE_UPLOAD_DIR || "/app/tmp_data";
const MAX_CONVERTED_IMAGE_WIDTH = process.env.MAX_CONVERTED_IMAGE_WIDTH
  ? parseInt(process.env.MAX_CONVERTED_IMAGE_WIDTH, 10)
  : 1600;

/**
 * Resizes an image buffer to a max width (from env or 1600px) (without enlargement) and returns a base64 data URL string.
 * @param buf The image buffer
 * @param mime The mime type (e.g., 'image/png', 'image/jpeg')
 * @param noResize If true, skips resizing and returns the original buffer as a base64 data URL
 * @example
 * ```ts
 * const dataUrl = await bufferToBase64ImageDataUrl(imageBuffer, 'image/png', false);
 * ```
 * @returns A Promise<string> with the data URL
 */
export async function bufferToBase64ImageDataUrl(
  buf: Buffer,
  mime: string,
  noResize: boolean = false
): Promise<string> {
  const resized = noResize
    ? buf
    : await sharp(buf)
        .resize({ width: MAX_CONVERTED_IMAGE_WIDTH, withoutEnlargement: true })
        .toBuffer();
  return `data:${mime};base64,${resized.toString("base64")}`;
}

/**
 * Loads a binary file from the tmp_data directory and converts it to a base64 image data URL.
 * @param filename The name of the file in the tmp_data directory
 * @param mime The mime type (e.g., 'image/png', 'image/jpeg')
 * @param noResize If true, skips resizing and returns the original buffer as a base64 data URL
 * @returns A Promise<string> with the data URL
 */
export async function uploadedFileToImageDataUrl(
  filename: string,
  mime: string,
  noResize: boolean = false
): Promise<string> {
  const filePath = path.join(process.cwd(), FILE_UPLOAD_DIR, filename);
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`File not found at path: ${filePath}`);
  }
  const buf = await fs.readFile(filePath);
  return bufferToBase64ImageDataUrl(buf, mime, noResize);
}
