import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { PassportTools } from "../tools/passport-tools";

dotenv.config();

describe("PassportTools.getPassports (Real DB)", () => {
  let passportTools: PassportTools;
  let prisma: PrismaClient;
  let dbAvailable = false;

  beforeAll(async () => {
    prisma = new PrismaClient();
    passportTools = new PassportTools();

    // Check database connectivity
    try {
      await prisma.$connect();
      dbAvailable = true;
    } catch (error) {
      console.warn("Database not available, skipping real DB tests:", error);
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await prisma.$disconnect();
    }
  });

  it("should find GALASSI/STEFANO using PassportTools.getPassports with case-insensitive search", async () => {
    if (!dbAvailable) return;
    const result = await passportTools.getPassports({
      surname: "galassi",
      given_names: "stefano",
    });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as any[]).length).toBeGreaterThan(0);
    const found = (result.data as any[]).some(
      (r) =>
        r.surname.toLowerCase() === "galassi" &&
        r.given_names.toLowerCase() === "stefano"
    );
    expect(found).toBe(true);
  });
});
