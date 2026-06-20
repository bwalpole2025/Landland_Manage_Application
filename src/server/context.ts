// Request-context factory for tRPC. Kept separate from trpc.ts so that the
// router/procedures module stays free of next/headers at runtime.

import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import type { TRPCContext } from "@/server/trpc";

export async function createTRPCContext(): Promise<TRPCContext> {
  const session = await getSession();
  return { session, prisma };
}
