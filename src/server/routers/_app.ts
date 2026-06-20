import { router } from "@/server/trpc";
import { accountRouter } from "./account";
import { authRouter } from "./auth";
import { dashboardRouter } from "./dashboard";

export const appRouter = router({
  auth: authRouter,
  account: accountRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
