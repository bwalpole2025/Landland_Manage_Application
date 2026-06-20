"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthShell, AuthField, AuthSubmit, AuthError, AuthSuccess } from "@/components/auth/AuthShell";
import { trpc } from "@/lib/trpc/client";

const schema = z.object({
  firstName: z.string().min(1, "Enter your first name").max(80),
  lastName: z.string().min(1, "Enter your last name").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const registerUser = trpc.auth.register.useMutation();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    await registerUser.mutateAsync({
      name: `${values.firstName} ${values.lastName}`.trim(),
      email: values.email,
      password: values.password,
    });
  }

  if (registerUser.isSuccess) {
    return (
      <AuthShell
        title="Check your inbox"
        footer={
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Back to sign in
          </Link>
        }
      >
        <div className="mt-4">
          <AuthSuccess>
            We&apos;ve sent a verification link to <strong>{getValues("email")}</strong>. Confirm
            your email, then sign in.
          </AuthSuccess>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start tracking your portfolio in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Sign in
          </Link>
        </>
      }
    >
      <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <AuthField label="First name" error={errors.firstName?.message}>
            <input autoComplete="given-name" className="input" {...register("firstName")} />
          </AuthField>
          <AuthField label="Last name" error={errors.lastName?.message}>
            <input autoComplete="family-name" className="input" {...register("lastName")} />
          </AuthField>
        </div>

        <AuthField label="Email" error={errors.email?.message}>
          <input type="email" autoComplete="email" className="input" {...register("email")} />
        </AuthField>

        <AuthField label="Password" error={errors.password?.message} hint="At least 8 characters.">
          <input type="password" autoComplete="new-password" className="input" {...register("password")} />
        </AuthField>

        {registerUser.error ? <AuthError>{registerUser.error.message}</AuthError> : null}

        <AuthSubmit pending={isSubmitting}>{isSubmitting ? "Creating account…" : "Create account"}</AuthSubmit>
      </form>
    </AuthShell>
  );
}
