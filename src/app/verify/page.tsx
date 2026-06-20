"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell, AuthField, AuthSubmit, AuthError, AuthSuccess } from "@/components/auth/AuthShell";
import { trpc } from "@/lib/trpc/client";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const verify = trpc.auth.verifyEmail.useMutation();
  const ran = useRef(false);

  useEffect(() => {
    if (token && !ran.current) {
      ran.current = true;
      verify.mutate({ token });
    }
  }, [token, verify]);

  // No token — show a resend form.
  if (!token) return <ResendForm />;

  if (verify.isPending || verify.isIdle) {
    return (
      <AuthShell title="Verifying your email…">
        <p className="mt-4 text-sm text-slate-500">One moment while we confirm your address.</p>
      </AuthShell>
    );
  }

  if (verify.data?.ok) {
    return (
      <AuthShell
        title="Email verified 🎉"
        footer={
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Continue to sign in
          </Link>
        }
      >
        <div className="mt-4">
          <AuthSuccess>Your email address is confirmed. You can now sign in.</AuthSuccess>
        </div>
      </AuthShell>
    );
  }

  // Token invalid/expired → let them request a new link.
  return <ResendForm invalid />;
}

function ResendForm({ invalid }: { invalid?: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const resend = trpc.auth.resendVerification.useMutation();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await resend.mutateAsync({ email });
    setSent(true);
  }

  return (
    <AuthShell
      title={invalid ? "Link expired" : "Verify your email"}
      subtitle={
        invalid
          ? "That verification link is invalid or has expired. Request a fresh one below."
          : "Enter your email to receive a new verification link."
      }
      footer={
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="mt-4">
          <AuthSuccess>If that account exists and is unverified, a new link is on its way.</AuthSuccess>
        </div>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
          <AuthField label="Email">
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </AuthField>
          {resend.error ? <AuthError>{resend.error.message}</AuthError> : null}
          <AuthSubmit pending={resend.isPending}>
            {resend.isPending ? "Sending…" : "Resend verification email"}
          </AuthSubmit>
        </form>
      )}
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<AuthShell title="Verifying your email…">{null}</AuthShell>}>
      <VerifyInner />
    </Suspense>
  );
}
