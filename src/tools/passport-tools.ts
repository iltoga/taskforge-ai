import { Passport, PrismaClient } from "@prisma/client";

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
  documentId?: number; // Optional, used for linking to uploaded documents
}

export interface PassportToolResult {
  success: boolean;
  data?: Passport | Passport[];
  error?: string;
  message?: string;
}

/**
 * Tool category: 'passport'.
 * Used by the orchestrator to route customer/passport-related queries.
 */
export class PassportTools {
  static category = "passport";
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Create a new passport record
   * All fields except 'surname' and 'given_names' must be translated to English before storing in the database.
   */
  async createPassport(data: PassportInput): Promise<PassportToolResult> {
    try {
      const passport = await this.prisma.passport.create({ data });
      return { success: true, data: passport };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * This method allows for flexible searching of passport records based on various criteria.
   * Supports complex queries:
   * - Surname and given names can be searched with partial, swapped, or mixed terms
   * - Case-insensitive search for strings
   * - Exact match for other fields
   * - Direct match for non-string fields (e.g., booleans, numbers)
   *
   * @param filter - Partial passport input to filter results
   * @returns A promise that resolves to a PassportToolResult containing the matching passports or an error message.
   */
  async getPassports(
    filter: Partial<PassportInput> = {}
  ): Promise<PassportToolResult> {
    try {
      // Build OR conditions for robust case-insensitive matching
      const where: Record<string, unknown> = {};
      const or: Array<Record<string, unknown>> = [];

      // If surname or given_names are provided, build OR for each
      if (filter.surname && typeof filter.surname === "string") {
        or.push({ surname: { contains: filter.surname, mode: "insensitive" } });
        or.push({
          given_names: { contains: filter.surname, mode: "insensitive" },
        });
      }
      if (filter.given_names && typeof filter.given_names === "string") {
        or.push({
          surname: { contains: filter.given_names, mode: "insensitive" },
        });
        or.push({
          given_names: { contains: filter.given_names, mode: "insensitive" },
        });
      }

      // Other fields (case-insensitive exact match for strings, direct for others)
      for (const [key, value] of Object.entries(filter)) {
        if (key === "surname" || key === "given_names") continue;
        if (typeof value === "string") {
          where[key] = { equals: value, mode: "insensitive" };
        } else {
          where[key] = value;
        }
      }

      // Combine OR with other filters
      const query = or.length > 0 ? { ...where, OR: or } : where;
      console.log(
        "[PassportTools.getPassports] Query:",
        JSON.stringify(query, null, 2)
      );
      const passports = await this.prisma.passport.findMany({ where: query });
      console.log(
        "[PassportTools.getPassports] Results:",
        JSON.stringify(passports, null, 2)
      );
      return { success: true, data: passports };
    } catch (error: unknown) {
      console.error("[PassportTools.getPassports] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update a passport record by id
   */
  async updatePassport(
    id: number,
    data: Partial<PassportInput>
  ): Promise<PassportToolResult> {
    try {
      const passport = await this.prisma.passport.update({
        where: { id },
        data,
      });
      return { success: true, data: passport };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
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
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List all passport records
   */
  async listPassports(): Promise<PassportToolResult> {
    try {
      const passports = await this.prisma.passport.findMany();
      return { success: true, data: passports };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
