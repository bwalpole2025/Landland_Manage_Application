"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/ui";
import { trpc } from "@/lib/trpc/client";
import { SettingsCard, Labeled, StatusLine } from "./parts";
import type { SettingsUser } from "./types";

export function MobileSection({ user }: { user: SettingsUser }) {
  const router = useRouter();
  const [mobile, setMobile] = useState(user.mobile ?? "");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);

  const send = trpc.profile.sendMobileCode.useMutation();
  const verify = trpc.profile.verifyMobileCode.useMutation();

  async function onSend() {
    setStatus(null);
    try {
      await send.mutateAsync({ mobile });
      setCodeSent(true);
      setStatus({ kind: "ok", message: "We've texted you a 6-digit code." });
      router.refresh();
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not send code." });
    }
  }

  async function onVerify() {
    setStatus(null);
    try {
      await verify.mutateAsync({ code });
      setCodeSent(false);
      setCode("");
      setStatus({ kind: "ok", message: "Mobile number verified." });
      router.refresh();
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not verify code." });
    }
  }

  const numberChanged = mobile.replace(/\s+/g, "") !== (user.mobile ?? "");

  return (
    <SettingsCard
      title="Mobile number"
      description="Used for security codes and important alerts."
      badge={
        user.mobileVerified && !numberChanged ? (
          <Badge tone="success">Verified</Badge>
        ) : user.mobile ? (
          <Badge tone="warning">Unverified</Badge>
        ) : (
          <Badge tone="neutral">Not set</Badge>
        )
      }
      footer={
        <>
          <StatusLine status={status} />
          {codeSent ? (
            <Button onClick={onVerify} disabled={verify.isPending || code.length !== 6}>
              {verify.isPending ? "Verifying…" : "Verify code"}
            </Button>
          ) : (
            <Button onClick={onSend} disabled={send.isPending || mobile.trim().length < 7}>
              {send.isPending ? "Sending…" : user.mobileVerified && !numberChanged ? "Resend code" : "Send code"}
            </Button>
          )}
        </>
      }
    >
      <Labeled label="Mobile number">
        <input
          type="tel"
          autoComplete="tel"
          placeholder="+44 7700 900000"
          className="input max-w-xs"
          value={mobile}
          onChange={(e) => {
            setMobile(e.target.value);
            setCodeSent(false);
          }}
        />
      </Labeled>

      {codeSent ? (
        <Labeled label="Verification code">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            className="input max-w-[10rem] tracking-[0.3em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </Labeled>
      ) : null}
    </SettingsCard>
  );
}
