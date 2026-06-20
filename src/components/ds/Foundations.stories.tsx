import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Foundations/Tokens",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

const SCALES: { name: string; role: string; prefix: string; stops: number[] }[] = [
  { name: "Brand (primary)", role: "Logo, active nav, primary buttons, highlights", prefix: "brand", stops: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] },
  { name: "Accent (secondary)", role: "Secondary actions, e.g. Import file", prefix: "accent", stops: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] },
  { name: "Success", role: "Positive / credit / completed", prefix: "success", stops: [50, 100, 200, 500, 600, 700, 800] },
  { name: "Warning", role: "Warnings / trial banners", prefix: "warning", stops: [50, 100, 200, 500, 600, 700, 800] },
  { name: "Danger", role: "Arrears / overdue", prefix: "danger", stops: [50, 100, 200, 500, 600, 700, 800] },
  { name: "Neutral (slate)", role: "Text, borders, app background", prefix: "slate", stops: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
];

// Static class names so Tailwind keeps them in the build.
const BG: Record<string, string> = {
  "brand-50": "bg-brand-50", "brand-100": "bg-brand-100", "brand-200": "bg-brand-200", "brand-300": "bg-brand-300", "brand-400": "bg-brand-400", "brand-500": "bg-brand-500", "brand-600": "bg-brand-600", "brand-700": "bg-brand-700", "brand-800": "bg-brand-800", "brand-900": "bg-brand-900", "brand-950": "bg-brand-950",
  "accent-50": "bg-accent-50", "accent-100": "bg-accent-100", "accent-200": "bg-accent-200", "accent-300": "bg-accent-300", "accent-400": "bg-accent-400", "accent-500": "bg-accent-500", "accent-600": "bg-accent-600", "accent-700": "bg-accent-700", "accent-800": "bg-accent-800", "accent-900": "bg-accent-900", "accent-950": "bg-accent-950",
  "success-50": "bg-success-50", "success-100": "bg-success-100", "success-200": "bg-success-200", "success-500": "bg-success-500", "success-600": "bg-success-600", "success-700": "bg-success-700", "success-800": "bg-success-800",
  "warning-50": "bg-warning-50", "warning-100": "bg-warning-100", "warning-200": "bg-warning-200", "warning-500": "bg-warning-500", "warning-600": "bg-warning-600", "warning-700": "bg-warning-700", "warning-800": "bg-warning-800",
  "danger-50": "bg-danger-50", "danger-100": "bg-danger-100", "danger-200": "bg-danger-200", "danger-500": "bg-danger-500", "danger-600": "bg-danger-600", "danger-700": "bg-danger-700", "danger-800": "bg-danger-800",
  "slate-50": "bg-slate-50", "slate-100": "bg-slate-100", "slate-200": "bg-slate-200", "slate-300": "bg-slate-300", "slate-400": "bg-slate-400", "slate-500": "bg-slate-500", "slate-600": "bg-slate-600", "slate-700": "bg-slate-700", "slate-800": "bg-slate-800", "slate-900": "bg-slate-900",
};

export const Colours: Story = {
  render: () => (
    <div className="space-y-8 p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Colour tokens</h1>
        <p className="mt-1 text-slate-500">Brand purple/indigo, teal accent, and semantic colours.</p>
      </header>
      {SCALES.map((scale) => (
        <section key={scale.prefix}>
          <h2 className="text-base font-semibold text-slate-900">{scale.name}</h2>
          <p className="text-sm text-slate-500">{scale.role}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {scale.stops.map((stop) => {
              const token = `${scale.prefix}-${stop}`;
              return (
                <div key={token} className="w-20">
                  <div className={`h-12 rounded-lg ring-1 ring-inset ring-black/5 ${BG[token]}`} />
                  <div className="mt-1 text-[11px] text-slate-500">{stop}</div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div className="space-y-6 p-8">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Typography</h1>
      <p className="text-slate-500">Poppins — a clean geometric sans.</p>
      <div className="space-y-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Page title</span>
          <p className="text-3xl font-bold tracking-tight text-slate-900">Your portfolio at a glance</p>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Card heading</span>
          <p className="text-base font-semibold text-slate-900">Recent transactions</p>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Metric label (uppercase grey)</span>
          <p className="text-2xl font-bold text-slate-900">£3,350</p>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Body</span>
          <p className="text-sm text-slate-600">Track rental income and expenses, monitor arrears, and stay MTD-ready.</p>
        </div>
      </div>
    </div>
  ),
};

export const RadiiAndShadows: Story = {
  render: () => (
    <div className="space-y-6 p-8">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Radius &amp; elevation</h1>
      <div className="flex flex-wrap items-end gap-6">
        <div className="text-center">
          <div className="h-16 w-28 rounded-pill bg-brand-600" />
          <div className="mt-2 text-xs text-slate-500">rounded-pill (buttons)</div>
        </div>
        <div className="text-center">
          <div className="h-16 w-28 rounded-card border border-slate-200 bg-white shadow-card" />
          <div className="mt-2 text-xs text-slate-500">rounded-card + shadow-card</div>
        </div>
        <div className="text-center">
          <div className="h-16 w-28 rounded-card border border-slate-200 bg-white shadow-card-hover" />
          <div className="mt-2 text-xs text-slate-500">shadow-card-hover</div>
        </div>
      </div>
    </div>
  ),
};
