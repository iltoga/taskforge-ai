import { z } from 'zod';
import { PassportFilterSchema, PassportIdSchema, PassportInputSchema } from './passport-tool-definitions';
import { PassportTools } from './passport-tools';
import { ToolRegistry } from './tool-registry';

export function registerPassportTools(registry: ToolRegistry, passportTools: PassportTools) {
  registry.registerTool(
    {
      name: 'setupPassportSchema',
      description: 'Ensure the passport table exists in the database.',
      parameters: z.object({}),
      category: 'passport',
    },
    async () => passportTools.setupSchema()
  );

  registry.registerTool(
    {
      name: 'createPassport',
      description: 'Create a new passport record.',
      parameters: PassportInputSchema,
      category: 'passport',
    },
    async (params: Record<string, unknown>) => passportTools.createPassport(params as unknown as Parameters<PassportTools['createPassport']>[0])
  );

  registry.registerTool(
    {
      name: 'getPassports',
      description: 'Read passport records by filter.',
      parameters: PassportFilterSchema,
      category: 'passport',
    },
    async (params: Record<string, unknown>) => passportTools.getPassports(params as Partial<Parameters<PassportTools['getPassports']>[0]>)
  );

  registry.registerTool(
    {
      name: 'updatePassport',
      description: 'Update a passport record by id.',
      parameters: PassportIdSchema.extend(PassportFilterSchema.shape),
      category: 'passport',
    },
    async (params: Record<string, unknown>) => {
      if (typeof params.id !== 'number') {
        return { success: false, error: 'Missing or invalid id' };
      }
      const { id, ...data } = params as { id: number } & Partial<Parameters<PassportTools['updatePassport']>[1]>;
      return passportTools.updatePassport(id, data);
    }
  );

  registry.registerTool(
    {
      name: 'deletePassport',
      description: 'Delete a passport record by id.',
      parameters: PassportIdSchema,
      category: 'passport',
    },
    async (params: Record<string, unknown>) => {
      if (typeof params.id !== 'number') {
        return { success: false, error: 'Missing or invalid id' };
      }
      return passportTools.deletePassport(params.id);
    }
  );
}
