import { PrismaClient } from "@prisma/client";
import { PassportInput, PassportTools } from "../tools/passport-tools";

describe("PassportTools.getPassports (DB integration)", () => {
  let passportTools: PassportTools;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    passportTools = new PassportTools();
    // Clean up test data
    await prisma.passport.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should find passports by partial, swapped, mixed, and case-insensitive name terms", async () => {
    // Insert test passports
    const testPassports: PassportInput[] = [
      {
        passport_number: "A123456",
        surname: "Smith",
        given_names: "John Michael",
        nationality: "USA",
        date_of_birth: new Date("1990-01-01"),
        sex: "M",
        place_of_birth: "New York",
        date_of_issue: new Date("2020-01-01"),
        date_of_expiry: new Date("2030-01-01"),
        issuing_authority: "US Gov",
        holder_signature_present: true,
        type: "P",
      },
      {
        passport_number: "B654321",
        surname: "johnson",
        given_names: "michael smith",
        nationality: "USA",
        date_of_birth: new Date("1985-05-05"),
        sex: "M",
        place_of_birth: "Los Angeles",
        date_of_issue: new Date("2015-05-05"),
        date_of_expiry: new Date("2025-05-05"),
        issuing_authority: "US Gov",
        holder_signature_present: true,
        type: "P",
      },
    ];
    for (const passport of testPassports) {
      await prisma.passport.create({ data: passport });
    }

    // Case-insensitive, partial, swapped, mixed term search
    const result1 = await passportTools.getPassports({ surname: "smith" });
    expect(result1.success).toBe(true);
    expect(Array.isArray(result1.data)).toBe(true);
    expect((result1.data as any[]).length).toBeGreaterThanOrEqual(1);

    const result2 = await passportTools.getPassports({
      given_names: "michael",
    });
    expect(result2.success).toBe(true);
    expect((result2.data as any[]).length).toBeGreaterThanOrEqual(1);

    const result3 = await passportTools.getPassports({
      surname: "john",
      given_names: "smith",
    });
    expect(result3.success).toBe(true);
    expect((result3.data as any[]).length).toBeGreaterThanOrEqual(1);

    const result4 = await passportTools.getPassports({
      surname: "SMITH",
      given_names: "JOHN",
    });
    expect(result4.success).toBe(true);
    expect((result4.data as any[]).length).toBeGreaterThanOrEqual(1);
  });

  it("should filter by other fields with case-insensitive string match and direct match for non-strings", async () => {
    const result = await passportTools.getPassports({
      nationality: "usa",
      type: "P",
      holder_signature_present: true,
    });
    expect(result.success).toBe(true);
    expect((result.data as any[]).length).toBeGreaterThanOrEqual(1);
  });
});
