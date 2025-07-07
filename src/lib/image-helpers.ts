import sharp from 'sharp';

const MAX_CONVERTED_IMAGE_WIDTH = process.env.MAX_CONVERTED_IMAGE_WIDTH
    ? parseInt(process.env.MAX_CONVERTED_IMAGE_WIDTH, 10)
    : 1600;

/**
 * Resizes an image buffer to a max width (from env or 1600px) (without enlargement) and returns a base64 data URL string.
 * @param buf The image buffer
 * @param mime The mime type (e.g., 'image/png', 'image/jpeg')
 * @returns A Promise<string> with the data URL
 */
export async function bufferToBase64ImageDataUrl(buf: Buffer, mime: string): Promise<string> {
    const resized = await sharp(buf)
        .resize({ width: MAX_CONVERTED_IMAGE_WIDTH, withoutEnlargement: true })
        .toBuffer();
    return `data:${mime};base64,${resized.toString('base64')}`;
}
