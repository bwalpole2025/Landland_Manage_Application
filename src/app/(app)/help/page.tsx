import { PageHeader, Card, Badge } from "@/components/ui";

const VIDEOS = [
  { title: "Getting started with Landland", length: "3:12", topic: "Basics" },
  { title: "Connecting your bank feed", length: "4:05", topic: "Transactions" },
  { title: "Adding a property and tenancy", length: "2:48", topic: "Properties" },
  { title: "Understanding your tax estimate", length: "5:20", topic: "Tax" },
  { title: "Submitting an MTD quarterly update", length: "3:40", topic: "MTD" },
  { title: "Storing documents & expiry reminders", length: "2:30", topic: "Files & Dates" },
];

export default function HelpPage() {
  return (
    <>
      <PageHeader
        title="Help"
        description="How-to videos and guides to get the most out of Landland."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VIDEOS.map((v) => (
          <a
            key={v.title}
            href="https://www.youtube.com/results?search_query=property+management+how+to"
            target="_blank"
            rel="noreferrer"
          >
            <Card className="h-full transition hover:border-brand-300 hover:shadow-md">
              <div className="flex aspect-video items-center justify-center rounded-t-xl bg-brand-50 text-brand-500">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="p-4">
                <Badge tone="brand">{v.topic}</Badge>
                <h3 className="mt-2 text-sm font-semibold text-slate-900">{v.title}</h3>
                <p className="mt-0.5 text-xs text-slate-500">How-to video · {v.length}</p>
              </div>
            </Card>
          </a>
        ))}
      </div>
    </>
  );
}
