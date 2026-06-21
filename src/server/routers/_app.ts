import { router } from "@/server/trpc";
import { accountRouter } from "./account";
import { authRouter } from "./auth";
import { billingRouter } from "./billing";
import { dashboardRouter } from "./dashboard";
import { essentialsRouter } from "./essentials";
import { feedsRouter } from "./feeds";
import { notificationsRouter } from "./notifications";
import { privacyRouter } from "./privacy";
import { profileRouter } from "./profile";
import { securityRouter } from "./security";
import { settingsRouter } from "./settings";
import { teamRouter } from "./team";

export const appRouter = router({
  auth: authRouter,
  account: accountRouter,
  billing: billingRouter,
  dashboard: dashboardRouter,
  essentials: essentialsRouter,
  feeds: feedsRouter,
  notifications: notificationsRouter,
  privacy: privacyRouter,
  profile: profileRouter,
  security: securityRouter,
  settings: settingsRouter,
  team: teamRouter,
});

export type AppRouter = typeof appRouter;
