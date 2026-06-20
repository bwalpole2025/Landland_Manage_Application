import { router } from "@/server/trpc";
import { accountRouter } from "./account";
import { authRouter } from "./auth";
import { dashboardRouter } from "./dashboard";
import { feedsRouter } from "./feeds";
import { profileRouter } from "./profile";
import { securityRouter } from "./security";
import { settingsRouter } from "./settings";
import { teamRouter } from "./team";

export const appRouter = router({
  auth: authRouter,
  account: accountRouter,
  dashboard: dashboardRouter,
  feeds: feedsRouter,
  profile: profileRouter,
  security: securityRouter,
  settings: settingsRouter,
  team: teamRouter,
});

export type AppRouter = typeof appRouter;
