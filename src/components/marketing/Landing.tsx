import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { PricingPlans } from "./PricingPlans";

// Public marketing landing page. Static, server-rendered. Anchor-nav to the
// Features, Pricing and About sections. Brand dark-green throughout; RAG colours
// appear only on the product mock's compliance status chips (status-only rule).

export function Landing({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <SiteNav signedIn={signedIn} />
      <Hero />
      <TrustStrip />
      <Features />
      <Pricing />
      <About />
      <FinalCta signedIn={signedIn} />
      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SiteNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2" aria-label="PropManage — home">
          <Logo className="h-8 w-8" />
          <span className="text-lg font-semibold tracking-tight text-slate-900">PropManage</span>
        </a>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#features" className="transition hover:text-brand-700">Features</a>
          <a href="#pricing" className="transition hover:text-brand-700">Pricing</a>
          <a href="#about" className="transition hover:text-brand-700">About us</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:text-brand-700"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Start free trial
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 via-white to-white" />
      <div className="pointer-events-none absolute -right-32 -top-32 -z-10 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Built for the Renters&rsquo; Rights Act 2025 &amp; Making Tax Digital
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
            Property compliance,
            <span className="text-brand-700"> handled with certainty.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            PropManage tracks every certificate, deadline and tax obligation across your whole
            portfolio &mdash; and tells you exactly what&rsquo;s compliant, what&rsquo;s due soon,
            and what needs action now. No guesswork, no missed dates.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              Start your free trial
            </Link>
            <a
              href="#features"
              className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-400 hover:text-brand-700"
            >
              Explore the features
            </a>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            30-day free trial &middot; no card required to start &middot; cancel anytime
          </p>
        </div>
        <HeroMock />
      </div>
    </section>
  );
}

// A faux product card — the only place RAG colours appear (compliance status).
function HeroMock() {
  const rows: { label: string; sub: string; status: "compliant" | "due_soon" | "overdue" }[] = [
    { label: "Gas safety (CP12)", sub: "Next due 30 Jul 2026", status: "compliant" },
    { label: "EICR — electrical", sub: "Next due 12 Aug 2026", status: "due_soon" },
    { label: "Deposit protection", sub: "Unprotected — blocks possession", status: "overdue" },
    { label: "Right to Rent", sub: "All tenants checked", status: "compliant" },
  ];
  return (
    <div className="relative">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Portfolio compliance</p>
            <p className="text-xs text-slate-500">Oakfield Road &middot; 4 obligations</p>
          </div>
          <Logo className="h-7 w-7" />
        </div>
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-800">{r.label}</p>
                <p className="font-mono text-xs text-slate-500">{r.sub}</p>
              </div>
              <StatusChip status={r.status} />
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -bottom-5 -left-5 hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg sm:block">
        <p className="text-xs text-slate-500">Estimated tax (SA105)</p>
        <p className="font-mono text-lg font-bold text-slate-900">£3,420.00</p>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: "compliant" | "due_soon" | "overdue" }) {
  const map = {
    compliant: { label: "Compliant", cls: "bg-green-100 text-green-800 ring-green-200" },
    due_soon: { label: "Due soon", cls: "bg-amber-100 text-amber-800 ring-amber-200" },
    overdue: { label: "Action needed", cls: "bg-red-100 text-red-800 ring-red-200" },
  }[status];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${map.cls}`}>
      {map.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

function TrustStrip() {
  const items = [
    "HMRC Making Tax Digital flow",
    "AES-256 encryption at rest",
    "Open Banking bank feeds",
    "Two-factor authentication",
    "Append-only audit trail",
  ];
  return (
    <div className="border-y border-slate-100 bg-slate-50/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-5 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
        {items.map((i) => (
          <span key={i}>{i}</span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const FEATURE_GROUPS: { title: string; blurb: string; points: string[] }[] = [
  {
    title: "Compliance engine",
    blurb: "A transparent rules engine computes every status and deadline — never a misleading “all clear”.",
    points: [
      "Gas Safety (CP12) with anniversary-preserving renewal dates",
      "EICR (5-yearly), EPC and smoke / CO alarm obligations",
      "Deposit protection & prescribed-information tracking — flags anything that blocks a possession claim",
      "Tenant Right to Rent checks with re-check reminders (England)",
      "HMO, additional and selective licensing with expiry tracking",
    ],
  },
  {
    title: "Tax & HMRC",
    blurb: "Stay ahead of Making Tax Digital for Income Tax without the spreadsheet panic.",
    points: [
      "SA105 income-tax estimates per portfolio and per owner",
      "Keep digital records and submit quarterly updates straight to HMRC",
      "OAuth connection — your Government Gateway password is never stored",
      "Delegated “as agent” access for your accountant",
    ],
  },
  {
    title: "Money & bookkeeping",
    blurb: "Every pound in and out of your portfolio, reconciled and ready.",
    points: [
      "Open Banking bank-feed import with one-click reconciliation",
      "Income, expense and manual-receipt tracking with categories",
      "Real-time rent arrears monitoring",
      "Reports you can filter by date and portfolio, then export to PDF or CSV",
    ],
  },
  {
    title: "Properties & tenancies",
    blurb: "Your whole portfolio, its people and its paperwork in one place.",
    points: [
      "Unlimited properties, portfolios and ownership splits",
      "Tenancy records and history under the Renters’ Rights Act",
      "Repairs & maintenance log timestamping each report and response (Awaab’s Law)",
      "Evidence trail that supports Section 8 grounds",
    ],
  },
  {
    title: "Documents, dates & reminders",
    blurb: "Nothing lapses on your watch.",
    points: [
      "Secure document vault — upload a certificate, confirm its expiry, get reminded",
      "Notes, reminders and a compliance calendar",
      "Proactive alerts before any certificate or licence expires",
    ],
  },
  {
    title: "Security & peace of mind",
    blurb: "Bank-grade protection for your data and your family’s livelihood.",
    points: [
      "AES-256 encryption at rest and two-factor authentication (TOTP)",
      "Role-based team access — owner, assistant, accountant",
      "Append-only audit trail of who changed what and when",
      "GDPR data export and account deletion; no card data ever stored",
    ],
  },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Everything you need</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            One app for the whole job
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            From the bank feed to the HMRC submission, and every certificate in between — here&rsquo;s
            what PropManage does.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURE_GROUPS.map((g) => (
            <div
              key={g.title}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-200 hover:shadow-md"
            >
              <h3 className="text-lg font-semibold text-slate-900">{g.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{g.blurb}</p>
              <ul className="mt-4 space-y-2.5">
                {g.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-sm text-slate-700">
                    <CheckIcon />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden>
      <circle cx="10" cy="10" r="9" className="fill-brand-50" />
      <path d="M6 10.5l2.5 2.5L14 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 bg-slate-50 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Simple pricing</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Start free. Upgrade when you&rsquo;re ready.
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            One honest plan that unlocks everything — no per-property fees, no surprises.
          </p>
        </div>

        <div className="mt-14">
          <PricingPlans />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function About() {
  return (
    <section id="about" className="scroll-mt-20 bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">About us</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Built by a mathematician, for real landlords
          </h2>
        </div>
        <div className="mt-10 space-y-5 text-lg leading-relaxed text-slate-600">
          <p>
            PropManage was created by an applied mathematician and software developer with a PhD in
            applied mathematics and many years spent turning hard, high-stakes problems into reliable
            code. That career has been about one thing above all: precision — software you can trust
            to be right.
          </p>
          <p>
            The app began with a very personal problem. Helping my own parents manage their property
            portfolio through the upheaval of the 2025 Renters&rsquo; Rights reforms and Making Tax
            Digital for Income Tax, I saw how much was being tracked by memory, spreadsheets and good
            luck — and how easily a missed certificate or deadline could turn into a serious,
            expensive problem.
          </p>
          <p>
            So I built the tool I wished existed. What started as a hand for one family has grown into
            a complete compliance-tracking platform — one that treats every deadline, certificate and
            tax obligation as a fact to be tracked exactly, never guessed. Every status you see comes
            from a transparent rules engine, not a black box, so you always know <em>why</em> something
            is due.
          </p>
          <p>
            The result is software that&rsquo;s mathematically rigorous under the hood and genuinely
            easy to use on the surface. My hope is that PropManage gives you the same confidence it now
            gives my own family — and hands you back the time you used to spend worrying.
          </p>
          <p className="pt-2 font-medium text-slate-800">— The founder, PropManage</p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="bg-brand-700">
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Take control of your portfolio today
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-brand-100">
          Set up in minutes. Start free, and never miss a compliance deadline again.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
            >
              Go to your dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
              >
                Start your free trial
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <span className="font-semibold tracking-tight text-slate-900">PropManage</span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-slate-500">
          <a href="#features" className="transition hover:text-brand-700">Features</a>
          <a href="#pricing" className="transition hover:text-brand-700">Pricing</a>
          <a href="#about" className="transition hover:text-brand-700">About</a>
          <Link href="/login" className="transition hover:text-brand-700">Sign in</Link>
        </nav>
        <p className="text-xs text-slate-400">© 2026 PropManage. Landlord finance &amp; compliance.</p>
      </div>
    </footer>
  );
}
