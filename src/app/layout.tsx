import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/client";

export const metadata: Metadata = {
  title: "Landland — Landlord finance & MTD",
  description:
    "Track rental income and expenses, monitor arrears, store compliance documents, estimate tax, and submit Making Tax Digital updates to HMRC.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
