"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, describedBy, Field, Notice, PasswordInput } from "@/components/ui";
import { authClient } from "@/lib/auth/client";

import { AuthHeading } from "../auth-heading";
import { authErrorMessage } from "../auth-errors";

const PASSWORD_HINT = "Al menos 10 caracteres.";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) return setConfirmError("Las contraseñas no coinciden.");
    setConfirmError(null);
    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setPending(false);
      return setError(authErrorMessage(error));
    }
    router.push("/ingresar");
  }

  return (
    <>
      <AuthHeading title="Elegí una contraseña nueva">
        Al cambiarla se cierran las sesiones abiertas en otros dispositivos.
      </AuthHeading>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Field id="password" label="Contraseña nueva" hint={PASSWORD_HINT}>
          <PasswordInput
            variant="filled"
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={10}
            required
            autoFocus
            aria-describedby={describedBy("password", { hint: PASSWORD_HINT })}
          />
        </Field>
        <Field id="confirm" label="Repetí la contraseña" error={confirmError}>
          <PasswordInput
            variant="filled"
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            minLength={10}
            required
            aria-invalid={confirmError ? true : undefined}
            aria-describedby={describedBy("confirm", { error: confirmError })}
          />
        </Field>
        <Button type="submit" size="lg" loading={pending} className="mt-2 w-full">
          {pending ? "Guardando" : "Cambiar contraseña"}
        </Button>
      </form>
    </>
  );
}
