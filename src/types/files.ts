export interface ProcessedFile {
  name: string;
  size: number;
  type: string;
  isImage?: boolean; // Flag to indicate if this is an image
  convertedImages?: string[]; // Array of image file names (for instance in case of multi-page documents converted to images)
  totalImageSize?: number; // Total size of all images if this is a multi-page document
  processAsImage?: boolean; // Flag to indicate if this file should be processed as an image or document
}

export interface ApiResponse {
  success: boolean;
  message: string;
  uploads: ProcessedFile[];
}

export interface DocumentInput {
  name: string;
  size: number;
  extension: string;
  fileType: string;
  mimeType: string;
  data: Buffer;
  rawOcrText?: string;
  rawLlmText?: string;
  category: string;
}
