import dotenv from 'dotenv';
dotenv.config();

import { ToolOrchestrator } from '../../services/tool-orchestrator';
import { CalendarTools } from '../../tools/calendar-tools';
import { PassportTools } from '../../tools/passport-tools';
import { createToolRegistry, ToolRegistry } from '../../tools/tool-registry';

jest.setTimeout(120_000);

const calendarStub = {
  getEvents: jest.fn().mockResolvedValue({ success: true, data: [] }),
  searchEvents: jest.fn().mockResolvedValue({ success: true, data: [] }),
  createEvent: jest.fn().mockResolvedValue({ success: true, data: null }),
  updateEvent: jest.fn().mockResolvedValue({ success: true, data: null }),
  deleteEvent: jest.fn().mockResolvedValue({ success: true, data: null }),
} as unknown as CalendarTools;

const prompt = `You have uploaded two documents, both belonging to the same person, Mario Rossi.

First Document:
Type: Identity card or similar official document.
Surname (Cognome): ROSSI
Name (Nome): MARIO
Date of Birth (Nato il): 21.04.1973
Act number (atto n.): 2311 P. 1 S. A.
Place of Birth (a): MILANO (MI)
Nationality (Cittadinanza): ITALIANA
Residence (Residenza): TABANAN (INDONESIA)
Address (Via): JL JALAK PUTIH N. 23
Marital Status (Stato civile): Not filled
Profession (Professione): IN ATTESA DI OCCUPAZIONE (Awaiting occupation)
Height (Statura): 1.72 m
Hair Color (Capelli): BRIZZOLATI (Grizzled/Grayish)
Eye Color (Occhi): MARRONI (Brown)
Signature of the holder (Firma del titolare) present.
Place and date of issue: AOSTA, 04.03.2018
Official stamps and signatures present.
Photo of the person.
Second Document:
Type: Italian Passport (Passaporto)
Passport Number: YB7658734
Surname (Cognome): ROSSI
Given Names (Nome): MARIO
Nationality (Cittadinanza): ITALIANA
Date of Birth (Data di nascita): 21 APR 1973
Sex (Sesso): M (Male)
Place of Birth (Luogo di nascita): MILANO (MI)
Date of Issue (Data di rilascio): 06 APR 2022
Date of Expiry (Data di scadenza): 05 APR 2032
Issuing Authority (Autorità): MINISTRO AFFARI ESTERI E COOPERAZIONE INTERNAZIONALE
Holder's signature present.
Residence (Residenza): TABANAN (IDN)
Height (Statura): 172 cm
Eye Color (Colore degli occhi): MARRONI (Brown)
Photo of the person.
Both documents belong to Mario Rossi, an Italian citizen born in Milan on April 21, 1973, currently residing in Tabanan, Indonesia. The first document appears to be an identity card or similar, issued in Aosta on March 4, 2018. The second document is an Italian passport issued on April 6, 2022, valid until April 5, 2032.

💡 Additional help:

Ask follow-up questions about the file contents
Request specific details or clarifications
Ask me to create calendar events based on the information


upload a passport document for me to create a passport record.`;

describe('passport flow via orchestrator', () => {
  let passportTools: PassportTools;
  let registry: ToolRegistry;
  let orchestrator: ToolOrchestrator;
  let createdId: number | undefined;

  beforeAll(async () => {
    passportTools = new PassportTools();
    registry = createToolRegistry(
      calendarStub,
      undefined,
      undefined,
      undefined,
      passportTools,
      { calendar: false, email: false, file: false, web: false, passport: true }
    );
    await registry.executeTool('setupPassportSchema', {});
    orchestrator = new ToolOrchestrator(process.env.OPENAI_API_KEY as string);
  });

  afterAll(async () => {
    if (createdId) await passportTools.deletePassport(createdId);
    // @ts-ignore
    await passportTools.prisma.$disconnect();
  });

  it('creates and deletes a passport record', async () => {
    const orchestrationRes = await orchestrator.orchestrate(
      prompt,
      [],                 // chat history
      registry,
      'gpt-4.1-mini',      // model
      { maxSteps: 10, maxToolCalls: 5 },
      []                  // fileIds
    );
    expect(orchestrationRes.success).toBe(true);

    const { data: createdPassports } = await passportTools.getPassports({ passport_number: 'YB7658734' });
    expect(Array.isArray(createdPassports)).toBe(true);
    expect((createdPassports as any[]).length).toBeGreaterThan(0);

    const passport = (createdPassports as any[])[0];
    createdId = passport.id;

    expect(passport).toMatchObject({
      passport_number: 'YB7658734',
      surname: 'ROSSI',
      given_names: 'MARIO',
      nationality: 'ITALIANA',
      place_of_birth: 'MILANO (MI)',
    });

    const deleteRes = await passportTools.deletePassport(createdId as number);
    expect(deleteRes.success).toBe(false);


  });
});