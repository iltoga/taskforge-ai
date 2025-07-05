// Lazy-load pdftopic so the file can be imported in edge/serverless
let pdftopic: typeof import('pdftopic') | null = null;

async function ensureDeps() {
  if (!pdftopic) {
    pdftopic = await import('pdftopic');
  }
}


export interface PdfPageResult {
  pageNumber: number;
  buffer: Buffer;
  width: number;
  height: number;
}


export interface PdfConversionOptions {
  pages?: number[] | number | 'all';
}


export class PdfConverter {
  /**
   * Convert PDF buffer to image buffers (all pages or specific pages)
   * @param pdfBuffer - The PDF file buffer
   * @param options - Conversion options (pages: number[] | number | 'all')
   * @returns Array of page results with buffers and metadata
   */
  static async convertToImages(
    pdfBuffer: Buffer,
    options: PdfConversionOptions = {}
  ): Promise<PdfPageResult[]> {
    await ensureDeps();
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF buffer is empty or invalid');
    }
    const pageSpec = options.pages ?? 'all';
    const buffers = await pdftopic!.pdftobuffer(pdfBuffer, pageSpec);
    if (!buffers) throw new Error('pdftobuffer returned null');

    const dims = await pdftopic!.getDimmentions(buffers);

    return buffers.map((buf, i) => ({
      pageNumber: i + 1,
      buffer: buf,
      width: dims.dimmentions[i]?.width ?? 0,
      height: dims.dimmentions[i]?.height ?? 0,
    }));
  }

  /**
   * Convert a single PDF page to image buffer
   * @param pdfBuffer - The PDF file buffer
   * @param pageNumber - Page number to convert (1-based)
   * @returns Single page result with buffer and metadata
   */
  static async convertSinglePage(
    pdfBuffer: Buffer,
    pageNumber: number
  ): Promise<PdfPageResult> {
    await ensureDeps();
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF buffer is empty or invalid');
    }
    if (pageNumber < 1) {
      throw new Error('Page number must be 1 or greater');
    }
    const buffers = await pdftopic!.pdftobuffer(pdfBuffer, [pageNumber]);
    if (!buffers || !buffers[0]) throw new Error(`Failed to convert page ${pageNumber}`);

    const dims = await pdftopic!.getDimmentions([buffers[0]]);
    return {
      pageNumber,
      buffer: buffers[0],
      width: dims.dimmentions[0]?.width ?? 0,
      height: dims.dimmentions[0]?.height ?? 0,
    };
  }

  /**
   * Get the total number of pages in a PDF
   * @param pdfBuffer - The PDF file buffer
   * @returns Number of pages
   */
  static async getPageCount(pdfBuffer: Buffer): Promise<number> {
    await ensureDeps();
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF buffer is empty or invalid');
    }
    return await pdftopic!.pdftocount(pdfBuffer);
  }

  /**
   * Concatenate multiple page images into a single image buffer
   * @param buffers - Array of image buffers
   * @returns Concatenated image buffer
   */
  static async concatImages(buffers: Buffer[]): Promise<Buffer> {
    await ensureDeps();
    return await pdftopic!.bufferstoappend(buffers);
  }
}



/**
 * Convenience wrapper for route.ts
 * Converts whole PDF buffer to array of PNG buffers.
 * Falls back to empty array if conversion fails.
 */
export async function convert(pdf: Buffer): Promise<Buffer[]> {
  try {
    await ensureDeps();
    const pages = await PdfConverter.convertToImages(pdf);
    return pages.map(p => p.buffer);
  } catch {
    return [];
  }
}