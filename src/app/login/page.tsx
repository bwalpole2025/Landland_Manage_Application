"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthShell, AuthField, AuthSubmit, AuthError } from "@/components/auth/AuthShell";
import { trpc } from "@/lib/trpc/client";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
  totp: z.string().optional(),
});
type LoginValues = z.infer<typeof loginSchema>;

// Credentials are pre-filled ONLY in development to ease local testing. In
// production users must enter their own — we never auto-fill credentials.
const isDev = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resent, setResent] = useState(false);
  const resend = trpc.auth.resendVerification.useMutation();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: isDev ? { email: "demo@landland.app", password: "Password123!" } : undefined,
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    setShowResend(false);
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
    if (data.code === "EMAIL_NOT_VERIFIED") setShowResend(true);
    setFormError(data.error ?? "Something went wrong. Please try again.");
  }

  async function onResend() {
    const email = getValues("email");
    if (!email) return;
    await resend.mutateAsync({ email });
    setResent(true);
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Sign in to your account."
      footer={
        <>
          New to Landland?{" "}
          <Link href="/register" className="font-medium text-brand-700 hover:text-brand-800">
            Create an account
          </Link>
        </>
      }
    >
      <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthField label="Email" error={errors.email?.message}>
          <input type="email" autoComplete="email" className="input" {...register("email")} />
        </AuthField>

        <AuthField label="Password" error={errors.password?.message}>
          <input type="password" autoComplete="current-password" className="input" {...register("password")} />
        </AuthField>

        {needsTotp ? (
          <AuthField label="Two-factor code" error={errors.totp?.message}>
            <input inputMode="numeric" autoComplete="one-time-code" className="input" {...register("totp")} />
          </AuthField>
        ) : null}

        {formError ? <AuthError>{formError}</AuthError> : null}

        {showResend ? (
          resent ? (
            <p className="text-sm text-emerald-700">Verification email sent — check your inbox.</p>
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={resend.isPending}
              className="text-sm font-medium text-brand-700 hover:text-brand-800 disabled:opacity-50"
            >
              Resend verification email
            </button>
          )
        ) : null}

        <AuthSubmit pending={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</AuthSubmit>
      </form>

      <div className="mt-4 text-center">
        <Link href="/forgot" className="text-sm font-medium text-brand-700 hover:text-brand-800">
          Forgot your password?
        </Link>
      </div>

      {isDev ? (
        <p className="mt-4 text-center text-xs text-slate-400">
          Dev only: demo credentials are pre-filled. Disabled in production.
        </p>
      ) : null}
    </AuthShell>
  );
}
