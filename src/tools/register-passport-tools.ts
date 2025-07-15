import { z } from "zod";
import {
  PassportFilterSchema,
  PassportIdSchema,
  PassportInputSchema,
} from "./passport-tool-definitions";
import { PassportTools } from "./passport-tools";
import { ToolRegistry } from "./tool-registry";

export function registerPassportTools(
  registry: ToolRegistry,
  passportTools: PassportTools
) {
  const TOOL_CATEGORY = "passport";

  registry.registerTool(
    {
      name: "createPassport",
      description:
        "Create a new passport record in the database. Use this to add passport information.",
      parameters: PassportInputSchema,
      category: TOOL_CATEGORY,
    },
    async (params: Record<string, unknown>) => {
      const p = params as {
        passport_number: string;
        surname: string;
        given_names: string;
        nationality: string;
        date_of_birth: string;
        sex: string;
        place_of_birth: string;
        date_of_issue: string;
        date_of_expiry: string;
        issuing_authority: string;
        holder_signature_present: boolean;
        residence?: string;
        height_cm?: number;
        eye_color?: string;
        type: string;
        document_id?: string;
      };

      // Convert date strings to Date objects
      const passportData = {
        ...p,
        date_of_birth: new Date(p.date_of_birth),
        date_of_issue: new Date(p.date_of_issue),
        date_of_expiry: new Date(p.date_of_expiry),
      };

      return passportTools.createPassport(passportData);
    }
  );

  registry.registerTool(
    {
      name: "getPassports",
      description:
        "Retrieve passport records from the database with optional filters. Use this to search for existing passports.",
      parameters: PassportFilterSchema,
      category: TOOL_CATEGORY,
    },
    async (params: Record<string, unknown>) => {
      const p = params as Record<string, unknown>;

      // Convert date strings to Date objects if provided
      const filters: Record<string, unknown> = { ...p };
      if (filters.date_of_birth && typeof filters.date_of_birth === "string") {
        filters.date_of_birth = new Date(filters.date_of_birth);
      }
      if (filters.date_of_issue && typeof filters.date_of_issue === "string") {
        filters.date_of_issue = new Date(filters.date_of_issue);
      }
      if (
        filters.date_of_expiry &&
        typeof filters.date_of_expiry === "string"
      ) {
        filters.date_of_expiry = new Date(filters.date_of_expiry);
      }

      return passportTools.getPassports(filters);
    }
  );

  registry.registerTool(
    {
      name: "updatePassport",
      description:
        "Update an existing passport record by ID. Use this to modify passport information.",
      parameters: PassportIdSchema.extend(PassportFilterSchema.shape),
      category: TOOL_CATEGORY,
    },
    async (params: Record<string, unknown>) => {
      if (typeof params.id !== "number") {
        return { success: false, error: "Missing or invalid id" };
      }
      const { id, ...updateData } = params as { id: number } & Record<
        string,
        unknown
      >;

      // Convert date strings to Date objects if provided
      if (
        updateData.date_of_birth &&
        typeof updateData.date_of_birth === "string"
      ) {
        updateData.date_of_birth = new Date(updateData.date_of_birth);
      }
      if (
        updateData.date_of_issue &&
        typeof updateData.date_of_issue === "string"
      ) {
        updateData.date_of_issue = new Date(updateData.date_of_issue);
      }
      if (
        updateData.date_of_expiry &&
        typeof updateData.date_of_expiry === "string"
      ) {
        updateData.date_of_expiry = new Date(updateData.date_of_expiry);
      }

      return passportTools.updatePassport(id, updateData);
    }
  );

  registry.registerTool(
    {
      name: "deletePassport",
      description:
        "Delete a passport record by ID. Use this to remove passport information.",
      parameters: PassportIdSchema,
      category: TOOL_CATEGORY,
    },
    async (params: Record<string, unknown>) => {
      if (typeof params.id !== "number") {
        return { success: false, error: "Missing or invalid id" };
      }
      return passportTools.deletePassport(params.id);
    }
  );

  registry.registerTool(
    {
      name: "listPassports",
      description:
        "List all passport records. Use this to retrieve all passport information without filters.",
      parameters: z.object({}),
      category: TOOL_CATEGORY,
    },
    async () => passportTools.listPassports()
  );
}
