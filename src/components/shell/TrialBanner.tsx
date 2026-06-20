"use client";

/** Persistent, dismissible free-trial banner shown across the app. */
export function TrialBanner({ daysLeft, onDismiss }: { daysLeft: number; onDismiss: () => void }) {
  const days = Math.max(0, daysLeft);
  return (
    <div className="flex items-center gap-3 border-b border-warning-200 bg-warning-50 px-4 py-2.5 text-sm text-warning-800 lg:px-6">
      <span aria-hidden className="select-none font-bold text-warning-600">
        ⚠
      </span>
      <p className="min-w-0 flex-1">
        You have <strong>{days} {days === 1 ? "day" : "days"} left</strong> in your free trial. Some
        functionalities are currently restricted:{" "}
        <a href="/help" className="font-semibold underline underline-offset-2 hover:text-warning-900">
          add a payment method
        </a>
        .
      </p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss trial banner"
        className="shrink-0 rounded p-1 text-warning-700 hover:bg-warning-100"
      >
        ✕
      </button>
    </div>
  );
}
