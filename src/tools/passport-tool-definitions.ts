import { z } from 'zod';

export const PassportInputSchema = z.object({
  passport_number: z.string().describe('Passport number'),
  surname: z.string().describe('Surname'),
  given_names: z.string().describe('Given names'),
  nationality: z.string().describe('Nationality'),
  date_of_birth: z.string().describe('Date of birth (ISO date)'),
  sex: z.string().length(1).describe('Sex (M/F)'),
  place_of_birth: z.string().describe('Place of birth'),
  date_of_issue: z.string().describe('Date of issue (ISO date)'),
  date_of_expiry: z.string().describe('Date of expiry (ISO date)'),
  issuing_authority: z.string().describe('Issuing authority'),
  holder_signature_present: z.boolean().describe("Holder's signature present"),
  residence: z.string().optional().describe('Residence'),
  height_cm: z.number().optional().describe('Height in cm'),
  eye_color: z.string().optional().describe('Eye color'),
  type: z.string().describe('Passport type'),
});

export const PassportIdSchema = z.object({
  id: z.number().describe('Passport record ID'),
});

export const PassportFilterSchema = PassportInputSchema.partial();
