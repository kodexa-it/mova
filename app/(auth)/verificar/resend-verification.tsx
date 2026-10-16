"use client";

import { useState, type FormEvent } from "react";

import { Button, Field, Input, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth/client";

import { authErrorMessage } from "../auth-errors";

export function ResendVerification({ defaultEmail }: { defaultEmail: string }) {
  const [state, setState] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    setPending(true);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/w" });
    setPending(false);
    setState(
      error
        ? { tone: "error", text: authErrorMessage(error) }
        : { tone: "success", text: "Si la cuenta existe y no está confirmada, te enviamos un enlace nuevo." },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {state ? <Notice tone={state.tone}>{state.text}</Notice> : null}
      <Field id="email" label="Email">
        <Input id="email" variant="filled" name="email" type="email" autoComplete="email" defaultValue={defaultEmail} required />
      </Field>
      <Button type="submit" size="lg" variant="secondary" loading={pending} className="w-full">
        {pending ? "Enviando" : "Reenviar enlace"}
      </Button>
    </form>
  );
}
