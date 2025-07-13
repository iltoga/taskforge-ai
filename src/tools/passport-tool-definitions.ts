export const DocumentInputSchema = z.object({
  name: z.string().describe("File name (e.g., passaporte_francisco.pdf)"),
  size: z.number().describe("File size in bytes (e.g., 204800)"),
  extension: z.string().describe("File extension (e.g., pdf, png)"),
  fileType: z
    .string()
    .describe(
      "File type (e.g., documento, imagem, outro) [document, image, other], translated in English"
    ),
  mimeType: z.string().describe("MIME type (e.g., application/pdf, image/png)"),
  data: z
    .any()
    .describe(
      "Raw file data as Buffer (Node.js) or Uint8Array (browser) to match Prisma Bytes type"
    ),
  rawOcrText: z
    .string()
    .optional()
    .describe(
      "Text extracted via OCR (optional, e.g., 'FRANCISCO MÜLLER nasceu em SÃO PAULO...')"
    ),
  rawLlmText: z
    .string()
    .optional()
    .describe(
      "Text extracted via LLM (optional, e.g., 'Francisco Müller, born in São Paulo...')"
    ),
  category: z
    .string()
    .optional()
    .describe(
      "File category (e.g., passport, document, image, other), always in English"
    ),
});
import { z } from "zod";

export const PassportInputSchema = z.object({
  passport_number: z.string().describe("Passport number (e.g., ZH9876543)"),
  surname: z.string().describe("Surname (e.g., MÜLLER, Do not translate)"),
  given_names: z
    .string()
    .describe("Given names (e.g., JÜRGEN, Do not translate)"),
  nationality: z
    .string()
    .describe("Nationality (e.g., DEUTSCH [GERMAN], translated in English)"),
  date_of_birth: z
    .string()
    .describe("Date of birth (ISO date, e.g., 1975-12-31)"),
  sex: z.string().length(1).describe("Sex (M/F)"),
  place_of_birth: z
    .string()
    .describe(
      "Place of birth (e.g., SÃO PAULO [SAO PAULO], translated in English)"
    ),
  date_of_issue: z
    .string()
    .describe("Date of issue (ISO date, e.g., 2015-06-15)"),
  date_of_expiry: z
    .string()
    .describe("Date of expiry (ISO date, e.g., 2025-06-15)"),
  issuing_authority: z
    .string()
    .describe(
      "Issuing authority (e.g., POLIZEIPRÄSIDIUM BERLIN [POLICE HEADQUARTERS BERLIN], translated in English)"
    ),
  holder_signature_present: z
    .boolean()
    .describe("Holder's signature present (true/false)"),
  residence: z
    .string()
    .optional()
    .describe(
      "Residence (e.g., AVENIDA LIBERDADE 123, LISBOA, Do not translate addresses"
    ),
  height_cm: z.number().optional().describe("Height in cm (e.g., 172)"),
  eye_color: z
    .string()
    .optional()
    .describe("Eye color (e.g., GRÜN [GREEN], translated in English)"),
  type: z
    .string()
    .describe(
      "Passport type (e.g., DIPLOMATISCH [DIPLOMATIC], translated in English)"
    ),
  documentId: z
    .number()
    .optional()
    .describe("ID of the uploaded file (Document). Add only if available."),
});

export const PassportIdSchema = z.object({
  id: z.number().describe("Passport record ID"),
});

export const PassportFilterSchema = PassportInputSchema.partial();
