"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthShell, AuthField, AuthSubmit, AuthSuccess } from "@/components/auth/AuthShell";
import { trpc } from "@/lib/trpc/client";

const schema = z.object({ email: z.string().email("Enter a valid email") });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const request = trpc.auth.requestPasswordReset.useMutation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    await request.mutateAsync(values);
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to set a new password."
      footer={
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Back to sign in
        </Link>
      }
    >
      {request.isSuccess ? (
        <div className="mt-4">
          <AuthSuccess>
            If an account exists for that email, a reset link is on its way.
          </AuthSuccess>
        </div>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <AuthField label="Email" error={errors.email?.message}>
            <input type="email" autoComplete="email" className="input" {...register("email")} />
          </AuthField>
          <AuthSubmit pending={isSubmitting}>{isSubmitting ? "Sending…" : "Send reset link"}</AuthSubmit>
        </form>
      )}
    </AuthShell>
  );
}
