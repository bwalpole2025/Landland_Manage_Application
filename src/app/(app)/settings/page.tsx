import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import type { SettingsData } from "@/components/settings/types";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { taxYearFor } from "@/lib/dates";
import { now } from "@/lib/clock";

export const dynamic = "force-dynamic";

/** Tax years from the current one down to 2014/15, newest first. */
function taxYearOptions(): string[] {
  const currentStart = Number(taxYearFor(now()).split("/")[0]);
  const out: string[] = [];
  for (let y = currentStart; y >= 2014; y--) {
    out.push(`${y}/${String((y + 1) % 100).padStart(2, "0")}`);
  }
  return out;
}

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user, account] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.account.findUnique({ where: { id: session.account.id } }),
  ]);
  if (!user || !account) redirect("/login");

  const data: SettingsData = {
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      emailVerified: user.emailVerified !== null,
      mobile: user.mobile,
      mobileVerified: user.mobileVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      numberOfPropertiesManaged: user.numberOfPropertiesManaged,
    },
    account: {
      timeZone: account.timeZone,
      firstTaxYear: account.firstTaxYear,
      marketingEmails: account.marketingEmails,
      notificationEmails: account.notificationEmails,
      subscriptionStatus: account.subscriptionStatus,
      trialEndsAt: account.trialEndsAt ? account.trialEndsAt.toISOString() : null,
    },
    role: session.role,
    taxYearOptions: taxYearOptions(),
  };

  return (
    <>
      <PageHeader
        title="Profile & settings"
        description="Manage your profile, security, subscription and team."
      />
      <SettingsScreen data={data} />
    </>
  );
}
