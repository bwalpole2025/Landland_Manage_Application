"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/ui";
import { trpc } from "@/lib/trpc/client";
import { SettingsCard, Labeled, StatusLine } from "./parts";
import type { SettingsUser } from "./types";

export function TwoFactorSection({ user }: { user: SettingsUser }) {
  const router = useRouter();
  const [enrolment, setEnrolment] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);

  const begin = trpc.security.beginTotp.useMutation();
  const confirm = trpc.security.confirmTotp.useMutation();
  const disable = trpc.security.disableTotp.useMutation();

  async function onBegin() {
    setStatus(null);
    try {
      const data = await begin.mutateAsync();
      setEnrolment(data ?? null);
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not start setup." });
    }
  }

  async function onConfirm() {
    setStatus(null);
    try {
      await confirm.mutateAsync({ code });
      setEnrolment(null);
      setCode("");
      setStatus({ kind: "ok", message: "Two-factor authentication enabled." });
      router.refresh();
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "That code is not valid." });
    }
  }

  async function onDisable() {
    setStatus(null);
    try {
      await disable.mutateAsync({ code });
      setDisabling(false);
      setCode("");
      setStatus({ kind: "ok", message: "Two-factor authentication disabled." });
      router.refresh();
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "That code is not valid." });
    }
  }

  // --- Enabled state ---
  if (user.twoFactorEnabled) {
    return (
      <SettingsCard
        title="Two-factor authentication"
        description="An authenticator code is required each time you sign in."
        badge={<Badge tone="success">Enabled</Badge>}
        footer={
          <>
            <StatusLine status={status} />
            {disabling ? (
              <Button variant="secondary" onClick={onDisable} disabled={disable.isPending || code.length !== 6}>
                {disable.isPending ? "Disabling…" : "Confirm disable"}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setDisabling(true)}>
                Disable
              </Button>
            )}
          </>
        }
      >
        {disabling ? (
          <Labeled label="Enter a current code to disable">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="input max-w-[10rem] tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </Labeled>
        ) : (
          <p className="text-sm text-slate-500">
            Your account is protected by an authenticator app.
          </p>
        )}
      </SettingsCard>
    );
  }

  // --- Disabled state ---
  return (
    <SettingsCard
      title="Two-factor authentication"
      description="Add a one-time code from an authenticator app to your sign-in."
      badge={<Badge tone="neutral">Off</Badge>}
      footer={
        <>
          <StatusLine status={status} />
          {enrolment ? (
            <Button onClick={onConfirm} disabled={confirm.isPending || code.length !== 6}>
              {confirm.isPending ? "Verifying…" : "Verify & enable"}
            </Button>
          ) : (
            <Button onClick={onBegin} disabled={begin.isPending}>
              {begin.isPending ? "Starting…" : "Set up two-factor"}
            </Button>
          )}
        </>
      }
    >
      {enrolment ? (
        <>
          <div>
            <p className="text-sm text-slate-700">
              Add PropManage to your authenticator app, then enter the 6-digit code it shows.
            </p>
            <p className="mt-2 text-sm text-slate-500">Can&apos;t scan? Enter this key manually:</p>
            <code className="mt-1 block break-all rounded-lg bg-slate-100 px-3 py-2 text-xs font-mono text-slate-800">
              {enrolment.secret}
            </code>
          </div>
          <Labeled label="Authenticator code">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="input max-w-[10rem] tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </Labeled>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          Two-factor adds a second step at sign-in using a code from an app like Google Authenticator
          or 1Password.
        </p>
      )}
    </SettingsCard>
  );
}
