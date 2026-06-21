import type { SubscriptionStatus } from "@/server/auth/session";

export interface SettingsUser {
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  mobile: string | null;
  mobileVerified: boolean;
  twoFactorEnabled: boolean;
  numberOfPropertiesManaged: number;
}

export interface SettingsAccount {
  timeZone: string;
  firstTaxYear: string | null;
  marketingEmails: boolean;
  notificationEmails: boolean;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
}

export interface SettingsData {
  user: SettingsUser;
  account: SettingsAccount;
  accountName: string;
  role: "owner" | "assistant" | "accountant";
  taxYearOptions: string[];
}
