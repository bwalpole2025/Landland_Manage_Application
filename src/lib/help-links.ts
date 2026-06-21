// Shared support/help destinations, used by the Help page and the floating
// help button. Externalised so they're easy to point at real URLs later.

export const HELP_LINKS = {
  /** Live 1:1 onboarding tutorial booking (e.g. Calendly). */
  tutorialBooking: "https://calendly.com/landland/onboarding-tutorial",
  /** Feedback / support inbox. */
  support: "mailto:support@landland.app?subject=Landland%20feedback",
  /** Help video library landing. */
  videoLibrary: "https://www.youtube.com/@landland",
};

export interface HelpVideo {
  title: string;
  length: string;
  topic: string;
  url: string;
}

const search = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

export const HELP_VIDEOS: HelpVideo[] = [
  { title: "Getting started with Landland", length: "3:12", topic: "Basics", url: search("landlord property management getting started") },
  { title: "Connecting your bank feed", length: "4:05", topic: "Transactions", url: search("open banking bank feed reconciliation") },
  { title: "Adding a property and tenancy", length: "2:48", topic: "Properties", url: search("add rental property tenancy") },
  { title: "Understanding your tax estimate", length: "5:20", topic: "Tax", url: search("UK landlord SA105 income tax estimate") },
  { title: "Submitting an MTD quarterly update", length: "3:40", topic: "MTD", url: search("making tax digital quarterly update HMRC") },
  { title: "Storing documents & expiry reminders", length: "2:30", topic: "Files & Dates", url: search("landlord compliance certificate reminders") },
];
