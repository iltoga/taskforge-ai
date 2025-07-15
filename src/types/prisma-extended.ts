// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrismaArgs = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrismaResult = any;

export interface SessionModel {
  updateMany: (args: AnyPrismaArgs) => Promise<AnyPrismaResult>;
  findFirst: (args: AnyPrismaArgs) => Promise<AnyPrismaResult>;
}

export type ExtendedPrismaClient = {
  session: SessionModel;
};
