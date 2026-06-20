"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/ui";
import { trpc } from "@/lib/trpc/client";
import { SettingsCard, Labeled, StatusLine } from "./parts";
import type { SettingsUser } from "./types";

export function ProfileSection({ user }: { user: SettingsUser }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [count, setCount] = useState(String(user.numberOfPropertiesManaged));
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);

  const update = trpc.profile.update.useMutation();

  const dirty =
    firstName !== user.firstName ||
    lastName !== user.lastName ||
    count !== String(user.numberOfPropertiesManaged);

  async function save() {
    setStatus(null);
    try {
      await update.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        numberOfPropertiesManaged: Number(count) || 0,
      });
      setStatus({ kind: "ok", message: "Profile saved." });
      router.refresh();
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not save." });
    }
  }

  return (
    <SettingsCard
      title="Profile"
      description="Your name and how many properties you manage."
      footer={
        <>
          <StatusLine status={status} />
          <Button onClick={save} disabled={!dirty || update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Labeled label="First name">
          <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Labeled>
        <Labeled label="Last name">
          <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Labeled>
      </div>
      <Labeled label="Number of properties managed">
        <input
          type="number"
          min={0}
          className="input max-w-[12rem]"
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
      </Labeled>
    </SettingsCard>
  );
}

export function EmailSection({ user }: { user: SettingsUser }) {
  const [sent, setSent] = useState(false);
  const resend = trpc.profile.resendEmailVerification.useMutation();

  async function onResend() {
    await resend.mutateAsync();
    setSent(true);
  }

  return (
    <SettingsCard
      title="Email address"
      badge={
        user.emailVerified ? (
          <Badge tone="success">Verified</Badge>
        ) : (
          <Badge tone="warning">Unverified</Badge>
        )
      }
    >
      <p className="text-sm text-slate-700">{user.email}</p>
      {!user.emailVerified ? (
        sent ? (
          <p className="text-sm text-emerald-700">Verification email sent — check your inbox.</p>
        ) : (
          <button
            type="button"
            onClick={onResend}
            disabled={resend.isPending}
            className="text-sm font-medium text-brand-700 hover:text-brand-800 disabled:opacity-50"
          >
            {resend.isPending ? "Sending…" : "Resend verification email"}
          </button>
        )
      ) : null}
    </SettingsCard>
  );
}

export function PasswordSection() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);
  const change = trpc.profile.changePassword.useMutation();

  async function save() {
    setStatus(null);
    if (next.length < 8) return setStatus({ kind: "err", message: "New password must be at least 8 characters." });
    if (next !== confirm) return setStatus({ kind: "err", message: "New passwords do not match." });
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      setStatus({ kind: "ok", message: "Password changed." });
      setCurrent("");
      setNext("");
      setConfirm("");
      router.refresh();
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not change password." });
    }
  }

  return (
    <SettingsCard
      title="Change password"
      description="Choose a strong password you don't use elsewhere."
      footer={
        <>
          <StatusLine status={status} />
          <Button onClick={save} disabled={change.isPending || !current || !next}>
            {change.isPending ? "Updating…" : "Update password"}
          </Button>
        </>
      }
    >
      <Labeled label="Current password">
        <input type="password" autoComplete="current-password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Labeled>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Labeled label="New password">
          <input type="password" autoComplete="new-password" className="input" value={next} onChange={(e) => setNext(e.target.value)} />
        </Labeled>
        <Labeled label="Confirm new password">
          <input type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Labeled>
      </div>
    </SettingsCard>
  );
}
