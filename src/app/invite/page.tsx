"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, AuthField, AuthSubmit, AuthError } from "@/components/auth/AuthShell";
import { trpc } from "@/lib/trpc/client";

const roleLabel: Record<string, string> = {
  ASSISTANT: "an assistant",
  ACCOUNTANT: "an accountant",
  OWNER: "an owner",
};

function InviteInner() {
  const token = useSearchParams().get("token");
  const router = useRouter();
  const preview = trpc.auth.invitationPreview.useQuery(
    { token: token ?? "" },
    { enabled: Boolean(token), retry: false },
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return <AuthShell title="Invalid invitation" subtitle="This invitation link is missing its token." >{null}</AuthShell>;
  }
  if (preview.isLoading) {
    return <AuthShell title="Loading invitation…">{null}</AuthShell>;
  }
  if (!preview.data) {
    return (
      <AuthShell
        title="Invitation not found"
        subtitle="This invitation is invalid, was revoked, or has expired."
        footer={<Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">Go to sign in</Link>}
      >
        {null}
      </AuthShell>
    );
  }

  const { email, role, accountName, userExists } = preview.data;

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        userExists ? { token } : { token, firstName, lastName, password },
      ),
    });
    setSubmitting(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error ?? "Could not accept the invitation.");
  }

  return (
    <AuthShell
      title={`Join ${accountName}`}
      subtitle={
        <>
          You&apos;ve been invited as {roleLabel[role] ?? "a team member"} for{" "}
          <strong>{email}</strong>.
        </>
      }
    >
      <form className="mt-5 space-y-4" onSubmit={accept} noValidate>
        {userExists ? (
          <p className="text-sm text-slate-600">
            You already have a PropManage account. Accept to gain delegated access to this account.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <AuthField label="First name">
                <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </AuthField>
              <AuthField label="Last name">
                <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </AuthField>
            </div>
            <AuthField label="Set a password" hint="At least 8 characters.">
              <input
                type="password"
                autoComplete="new-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </AuthField>
          </>
        )}

        {error ? <AuthError>{error}</AuthError> : null}

        <AuthSubmit pending={submitting}>{submitting ? "Joining…" : "Accept invitation"}</AuthSubmit>
      </form>
    </AuthShell>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<AuthShell title="Loading invitation…">{null}</AuthShell>}>
      <InviteInner />
    </Suspense>
  );
}
