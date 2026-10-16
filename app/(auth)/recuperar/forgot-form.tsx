"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button, Field, Input, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth/client";

import { AuthHeading } from "../auth-heading";
import { authErrorMessage } from "../auth-errors";

export function ForgotForm() {
  const [state, setState] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    setPending(true);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/restablecer" });
    setPending(false);
    // El mensaje es el mismo exista o no la cuenta.
    setState(
      error && error.status === 429
        ? { tone: "error", text: authErrorMessage(error) }
        : { tone: "success", text: "Si hay una cuenta con ese email, te enviamos un enlace para cambiar la contraseña. Vence en 1 hora." },
    );
  }

  return (
    <>
      <AuthHeading title="Recuperar contraseña">Te enviamos un enlace para elegir una contraseña nueva.</AuthHeading>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {state ? <Notice tone={state.tone}>{state.text}</Notice> : null}
        <Field id="email" label="Email">
          <Input id="email" variant="filled" name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <Button type="submit" size="lg" loading={pending} className="mt-2 w-full">
          {pending ? "Enviando" : "Enviar enlace"}
        </Button>
        <Link href="/ingresar" className="self-start text-small text-ink-2 underline-offset-4 hover:text-ink hover:underline">
          Volver a iniciar sesión
        </Link>
      </form>
    </>
  );
}
