import type { Prisma } from "../generated/prisma/client.js";

// Los valores que llegan validados por zod son JSON serializables, pero TypeScript
// no puede deducirlo de interfaces sin firma de índice. Este es el único cast.
export const asJson = (valor: unknown) => valor as Prisma.InputJsonValue;
