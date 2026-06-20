"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
  totp: z.string().optional(),
});
type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "demo@landland.app", password: "Password123!" },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (data.code === "TOTP_REQUIRED") setNeedsTotp(true);
    setFormError(data.error ?? "Something went wrong. Please try again.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-base font-bold text-white">
            L
          </span>
          <span className="text-xl font-semibold tracking-tight text-slate-900">Landland</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Welcome back. Sign in to your account.</p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Field label="Email" error={errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                className="input"
                {...register("email")}
              />
            </Field>

            <Field label="Password" error={errors.password?.message}>
              <input
                type="password"
                autoComplete="current-password"
                className="input"
                {...register("password")}
              />
            </Field>

            {needsTotp ? (
              <Field label="Two-factor code" error={errors.totp?.message}>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="input"
                  {...register("totp")}
                />
              </Field>
            ) : null}

            {formError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            Demo account is pre-filled — just click Sign in.
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
