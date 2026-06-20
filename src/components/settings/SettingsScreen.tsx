"use client";

import { ProfileSection, EmailSection, PasswordSection } from "./ProfileSection";
import { MobileSection } from "./MobileSection";
import { TwoFactorSection } from "./TwoFactorSection";
import { LocaleSection, SubscriptionSection, PreferencesSection } from "./AccountSections";
import { TeamSection } from "./TeamSection";
import type { SettingsData } from "./types";

export function SettingsScreen({ data }: { data: SettingsData }) {
  const isOwner = data.role === "owner";

  return (
    <div className="space-y-6">
      <ProfileSection user={data.user} />
      <EmailSection user={data.user} />
      <MobileSection user={data.user} />
      <PasswordSection />
      <TwoFactorSection user={data.user} />

      {isOwner ? (
        <>
          <LocaleSection account={data.account} taxYearOptions={data.taxYearOptions} />
          <SubscriptionSection account={data.account} />
          <PreferencesSection account={data.account} />
          <TeamSection />
        </>
      ) : null}
    </div>
  );
}
