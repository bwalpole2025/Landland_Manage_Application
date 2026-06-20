"use client";

import { useState } from "react";
import { Button, Badge } from "@/components/ui";
import { trpc } from "@/lib/trpc/client";
import { SettingsCard, Labeled, StatusLine } from "./parts";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ASSISTANT: "Assistant",
  ACCOUNTANT: "Accountant",
};

export function TeamSection() {
  const team = trpc.team.list.useQuery();
  const invite = trpc.team.invite.useMutation();
  const revoke = trpc.team.revoke.useMutation();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ASSISTANT" | "ACCOUNTANT">("ASSISTANT");
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);

  async function onInvite() {
    setStatus(null);
    try {
      await invite.mutateAsync({ email, role });
      setEmail("");
      setStatus({ kind: "ok", message: `Invitation sent to ${email}.` });
      team.refetch();
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not send invitation." });
    }
  }

  async function onRevoke(invitationId: string) {
    await revoke.mutateAsync({ invitationId });
    team.refetch();
  }

  return (
    <SettingsCard
      title="Team & delegated access"
      description="Invite an assistant or your accountant. They get delegated access to this account."
      footer={
        <>
          <StatusLine status={status} />
          <Button onClick={onInvite} disabled={invite.isPending || !email}>
            {invite.isPending ? "Sending…" : "Send invite"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <Labeled label="Email to invite">
          <input
            type="email"
            placeholder="accountant@example.com"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Labeled>
        <Labeled label="Role">
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as "ASSISTANT" | "ACCOUNTANT")}
          >
            <option value="ASSISTANT">Assistant</option>
            <option value="ACCOUNTANT">Accountant</option>
          </select>
        </Labeled>
      </div>

      <div className="mt-2">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Members</p>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {(team.data?.members ?? []).map((m) => (
            <li key={m.membershipId} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{m.name || m.email}</p>
                <p className="truncate text-xs text-slate-500">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.delegated ? <Badge tone="info">Delegated</Badge> : null}
                <Badge tone="neutral">{ROLE_LABEL[m.role] ?? m.role}</Badge>
              </div>
            </li>
          ))}
          {team.isLoading ? <li className="px-4 py-2.5 text-sm text-slate-400">Loading…</li> : null}
        </ul>
      </div>

      {(team.data?.pending.length ?? 0) > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Pending invitations</p>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {team.data!.pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{p.email}</p>
                  <p className="text-xs text-slate-500">Invited as {ROLE_LABEL[p.role] ?? p.role}</p>
                </div>
                <button
                  onClick={() => onRevoke(p.id)}
                  disabled={revoke.isPending}
                  className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SettingsCard>
  );
}
