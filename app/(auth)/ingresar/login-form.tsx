"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useShake } from "@/components/auth/use-shake";
import { Button, Field, Input, Notice, PasswordInput } from "@/components/ui";
import { authClient } from "@/lib/auth/client";

import { AuthHeading, enterAt } from "../auth-heading";
import { authErrorMessage } from "../auth-errors";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [formRef, shake] = useShake<HTMLFormElement>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setPending(false);
      setError(authErrorMessage(error));
      return shake();
    }
    router.push(next);
    router.refresh();
  }

  return (
    <>
      <AuthHeading title="Hola de nuevo.">Entrá para revisar lo que Mova preparó para tu marca esta semana.</AuthHeading>
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="animate-enter" style={enterAt(4)}>
          <Field id="email" label="Email">
            <Input id="email" name="email" type="email" variant="filled" autoComplete="email" required autoFocus placeholder="vos@empresa.com" />
          </Field>
        </div>
        <div className="animate-enter" style={enterAt(5)}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="password" className="text-small font-medium text-ink">
              Contraseña
            </label>
            <Link href="/recuperar" className="text-small text-ink-2 underline-offset-4 hover:text-accent hover:underline">
              ¿La olvidaste?
            </Link>
          </div>
          <PasswordInput id="password" name="password" variant="filled" autoComplete="current-password" required />
        </div>
        <div className="animate-enter mt-2" style={enterAt(6)}>
          <Button type="submit" size="lg" loading={pending} className="w-full">
            {pending ? "Iniciando sesión" : "Iniciar sesión"}
          </Button>
        </div>
      </form>
    </>
  );
}
