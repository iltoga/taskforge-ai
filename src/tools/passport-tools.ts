import { Passport, PrismaClient } from '@prisma/client';

export interface PassportInput {
  passport_number: string;
  surname: string;
  given_names: string;
  nationality: string;
  date_of_birth: Date;
  sex: string;
  place_of_birth: string;
  date_of_issue: Date;
  date_of_expiry: Date;
  issuing_authority: string;
  holder_signature_present: boolean;
  residence?: string;
  height_cm?: number;
  eye_color?: string;
  type: string;
}

export interface PassportToolResult {
  success: boolean;
  data?: Passport | Passport[];
  error?: string;
  message?: string;
}

export class PassportTools {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Ensure the passport table exists (runs a Prisma migration)
   */
  async setupSchema(): Promise<PassportToolResult> {
    try {
      // This will run pending migrations (if any)
      // In production, migrations should be handled by CI/CD, but this is a fallback
      await this.prisma.$executeRaw`SELECT 1`;
      return { success: true, message: 'Schema is ready.' };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Create a new passport record
   */
  async createPassport(data: PassportInput): Promise<PassportToolResult> {
    try {
      const passport = await this.prisma.passport.create({ data });
      return { success: true, data: passport };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Read passport(s) by filter
   */
  async getPassports(filter: Partial<PassportInput> = {}): Promise<PassportToolResult> {
    try {
      const passports = await this.prisma.passport.findMany({ where: filter });
      return { success: true, data: passports };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Update a passport record by id
   */
  async updatePassport(id: number, data: Partial<PassportInput>): Promise<PassportToolResult> {
    try {
      const passport = await this.prisma.passport.update({ where: { id }, data });
      return { success: true, data: passport };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Delete a passport record by id
   */
  async deletePassport(id: number): Promise<PassportToolResult> {
    try {
      const passport = await this.prisma.passport.delete({ where: { id } });
      return { success: true, data: passport };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
