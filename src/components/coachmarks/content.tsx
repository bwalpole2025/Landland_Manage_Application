import type { ReactNode } from "react";
import {
  PropertyIcon,
  TransactionsIcon,
  TaxIcon,
  FilesIcon,
  ReportsIcon,
  HomeIcon,
} from "@/components/icons";

export type CoachmarkSection =
  | "properties"
  | "ownership"
  | "tenancies"
  | "transactions"
  | "tax"
  | "documents"
  | "reports";

export interface CoachmarkStep {
  heading: string;
  bullets: string[];
}

export interface CoachmarkContent {
  /** Illustration shown above the heading. */
  icon: ReactNode;
  /** One step renders a simple coachmark; several add dot pagination + arrows. */
  steps: CoachmarkStep[];
}

const iconClass = "h-9 w-9";

export const COACHMARKS: Record<CoachmarkSection, CoachmarkContent> = {
  properties: {
    icon: <PropertyIcon className={iconClass} />,
    steps: [
      {
        heading: "Add a property",
        bullets: [
          "Add every property you own — your portfolio lives here.",
          "Track rent, expenses and compliance against each one.",
          "Record the purchase price and current valuation to watch your equity grow.",
          "Each property feeds straight into your tax estimate and reports.",
        ],
      },
    ],
  },
  ownership: {
    icon: <HomeIcon className={iconClass} />,
    steps: [
      {
        heading: "Personal or business ownership",
        bullets: [
          "Hold property personally, jointly, or through a limited company.",
          "Split beneficial ownership between owners — e.g. 50/50 with a partner.",
          "Income and expenses are apportioned pro-rata for each owner's tax.",
          "Get the split right here and the numbers flow correctly everywhere else.",
        ],
      },
    ],
  },
  tenancies: {
    icon: <HomeIcon className={iconClass} />,
    steps: [
      {
        heading: "Track your tenancies",
        bullets: [
          "Record the tenant, rent amount and payment frequency.",
          "Set the start date and we'll track rent due month by month.",
          "Arrears are flagged automatically when a payment is missed.",
          "Open-ended and fixed-term tenancies are both supported.",
        ],
      },
    ],
  },
  transactions: {
    icon: <TransactionsIcon className={iconClass} />,
    steps: [
      {
        heading: "Categorise rental income and expense",
        bullets: [
          "Assign each transaction to a property and a category.",
          "Categories map directly onto HMRC's SA105 UK-property tax boxes.",
          "Get it right once and your tax estimate stays accurate all year.",
        ],
      },
      {
        heading: "Your money, automatically imported",
        bullets: [
          "Connect a bank feed and transactions flow in automatically.",
          "Or add income and expenses manually whenever you need to.",
          "Every penny in and out is captured in one place.",
        ],
      },
      {
        heading: "Reconcile with confidence",
        bullets: [
          "Items needing review are flagged so nothing slips through.",
          "Mark transactions reconciled once you've checked them.",
          "Reconciled figures power your reports and MTD submissions.",
        ],
      },
    ],
  },
  tax: {
    icon: <TaxIcon className={iconClass} />,
    steps: [
      {
        heading: "Your live Tax Statement",
        bullets: [
          "See a year-to-date estimate of your property income tax.",
          "Income, expenses and taxable profit update as you go.",
          "Everything is mapped to HMRC's SA105 UK-property pages.",
          "It's an estimate to guide you — not formal tax advice.",
        ],
      },
    ],
  },
  documents: {
    icon: <FilesIcon className={iconClass} />,
    steps: [
      {
        heading: "Never miss a deadline",
        bullets: [
          "Store gas, electrical and EPC certificates against each property.",
          "Expiry dates are tracked and flagged before they lapse.",
          "Reminders mean a renewal never catches you out.",
          "Keep every important document in one searchable place.",
        ],
      },
    ],
  },
  reports: {
    icon: <ReportsIcon className={iconClass} />,
    steps: [
      {
        heading: "Understand your portfolio",
        bullets: [
          "See income, expenses and profit for the whole tax year.",
          "Break results down property by property.",
          "Spot where your money is going with an expense breakdown.",
          "Export a CSV to share with your accountant in seconds.",
        ],
      },
    ],
  },
};
