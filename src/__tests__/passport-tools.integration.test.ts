// Polyfill setImmediate for Prisma in Jest/test environments
(global as any).setImmediate = (fn: (...args: any[]) => void, ...args: any[]) => setTimeout(fn, 0, ...args);
import { PrismaClient } from '@prisma/client';
import { PassportInput, PassportTools } from '../tools/passport-tools';

describe('PassportTools (integration with real DB)', () => {
  const prisma = new PrismaClient();
  const passportTools = new PassportTools();
  let createdId: number;

  const testPassport: PassportInput = {
    passport_number: 'YB7658734',
    surname: 'GALASSI',
    given_names: 'STEFANO',
    nationality: 'ITALIANA',
    date_of_birth: new Date('1973-04-21'),
    sex: 'M',
    place_of_birth: 'MILANO (MI)',
    date_of_issue: new Date('2022-04-06'),
    date_of_expiry: new Date('2032-04-05'),
    issuing_authority: 'MINISTRO AFFARI ESTERI E COOPERAZIONE INTERNAZIONALE',
    holder_signature_present: true,
    residence: 'TABANAN (IDN)',
    height_cm: 172,
    eye_color: 'MARRONI',
    type: 'Passaporto',
  };

  afterAll(async () => {
    if (createdId) {
      try {
        await prisma.passport.delete({ where: { id: createdId } });
      } catch (err) {
        // Ignore not found errors
      }
    }
    await prisma.$disconnect();
  });

  it('should create a new passport', async () => {
    const result = await passportTools.createPassport(testPassport);
    if (!result.success) {
      console.error('Create error:', result.error);
    }
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('id');
    createdId = (result.data as any).id;
  });

  it('should read passport(s) by filter', async () => {
    const result = await passportTools.getPassports({ passport_number: testPassport.passport_number });
    if (!result.success) {
      console.error('Read error:', result.error);
    }
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as any[]).length).toBeGreaterThan(0);
  });

  it('should update a passport record by id', async () => {
    const result = await passportTools.updatePassport(createdId, { surname: 'UPDATED' });
    if (!result.success) {
      console.error('Update error:', result.error);
    }
    expect(result.success).toBe(true);
    expect((result.data as any).surname).toBe('UPDATED');
  });

  it('should delete a passport record by id', async () => {
    const result = await passportTools.deletePassport(createdId);
    if (!result.success) {
      console.error('Delete error:', result.error);
    }
    expect(result.success).toBe(true);
    // Confirm deletion
    const check = await passportTools.getPassports({ passport_number: testPassport.passport_number });
    expect((check.data as any[]).length).toBe(0);
  });
});
