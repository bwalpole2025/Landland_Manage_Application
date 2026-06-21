import { PageHeader, Card, Badge } from "@/components/ui";
import { HELP_LINKS, HELP_VIDEOS } from "@/lib/help-links";

export default function HelpPage() {
  return (
    <>
      <PageHeader
        title="Help & support"
        description="How-to videos, guides, and a live 1:1 tutorial to get the most out of PropManage."
      />

      {/* Live tutorial booking */}
      <Card className="flex flex-col items-start justify-between gap-4 border-brand-200 bg-brand-50/40 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Book a live tutorial</h2>
          <p className="mt-1 text-sm text-slate-600">
            Get a free 30-minute 1:1 walkthrough with our team — we&apos;ll set up your portfolio, bank feed and tax together.
          </p>
        </div>
        <a
          href={HELP_LINKS.tutorialBooking}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Book a tutorial
        </a>
      </Card>

      <h2 className="mt-6 text-sm font-semibold text-slate-900">How-to videos</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HELP_VIDEOS.map((v) => (
          <a key={v.title} href={v.url} target="_blank" rel="noreferrer" className="rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
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

      <p className="mt-6 text-sm text-slate-500">
        Still stuck?{" "}
        <a href={HELP_LINKS.support} className="font-medium text-brand-600 hover:underline">
          Email our support team
        </a>
        .
      </p>
    </>
  );
}
