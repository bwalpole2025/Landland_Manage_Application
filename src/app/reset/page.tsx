"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthShell, AuthField, AuthSubmit, AuthError, AuthSuccess } from "@/components/auth/AuthShell";
import { trpc } from "@/lib/trpc/client";

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });
type Values = z.infer<typeof schema>;

function ResetInner() {
  const token = useSearchParams().get("token");
  const reset = trpc.auth.resetPassword.useMutation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    if (!token) return;
    await reset.mutateAsync({ token, password: values.password });
  }

  if (!token) {
    return (
      <AuthShell title="Invalid reset link" subtitle="This link is missing or malformed.">
        <div className="mt-4">
          <Link href="/forgot" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Request a new reset link
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (reset.isSuccess && reset.data.ok) {
    return (
      <AuthShell
        title="Password updated"
        footer={
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Continue to sign in
          </Link>
        }
      >
        <div className="mt-4">
          <AuthSuccess>Your password has been changed. Sign in with your new password.</AuthSuccess>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you don't use elsewhere.">
      <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthField label="New password" error={errors.password?.message} hint="At least 8 characters.">
          <input type="password" autoComplete="new-password" className="input" {...register("password")} />
        </AuthField>
        <AuthField label="Confirm password" error={errors.confirm?.message}>
          <input type="password" autoComplete="new-password" className="input" {...register("confirm")} />
        </AuthField>

        {reset.isSuccess && !reset.data.ok ? (
          <AuthError>That reset link is invalid or has expired.</AuthError>
        ) : null}
        {reset.error ? <AuthError>{reset.error.message}</AuthError> : null}

        <AuthSubmit pending={isSubmitting}>{isSubmitting ? "Updating…" : "Update password"}</AuthSubmit>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell title="Set a new password">{null}</AuthShell>}>
      <ResetInner />
    </Suspense>
  );
}
