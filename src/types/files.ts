export interface ProcessedFile {
  fileName: string;
  fileSize: number;
  fileType: string;
  isImage?: boolean; // Flag to indicate if this is an image
}

export interface ApiResponse {
  success: boolean;
  message: string;
  uploads: ProcessedFile[];
}
