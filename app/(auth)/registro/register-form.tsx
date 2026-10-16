"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useShake } from "@/components/auth/use-shake";
import { Button, Field, Input, Notice, PasswordInput } from "@/components/ui";
import { authClient } from "@/lib/auth/client";

import { AuthHeading, enterAt } from "../auth-heading";
import { authErrorMessage } from "../auth-errors";

const MIN = 10;

// Indicador de largo de la contraseña: diez marcas que se completan y un tilde
// al llegar al mínimo. Lo visual es decorativo; el requisito se anuncia en texto.
function LengthMeter({ length, invalid }: { length: number; invalid: boolean }) {
  const done = length >= MIN;
  return (
    <div className="mt-2.5 flex items-center gap-3">
      <div aria-hidden className="flex flex-1 gap-1">
        {Array.from({ length: MIN }, (_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-[var(--dur-base)] ease-[var(--ease-standard)] ${
              i < length ? (done ? "bg-success" : invalid ? "bg-danger" : "bg-accent") : "bg-pearl-strong"
            }`}
            style={{ transitionDelay: `${i * 12}ms` }}
          />
        ))}
      </div>
      <span id="password-hint" className={`tabular flex min-w-[7.5rem] items-center justify-end gap-1 text-caption ${done ? "text-success" : invalid ? "text-danger" : "text-ink-2"}`}>
        {done ? (
          <>
            <svg aria-hidden viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m2.5 6.2 2.3 2.3 4.7-5" strokeDasharray="14" className="animate-[check-draw_300ms_var(--ease-standard)_both]" />
            </svg>
            Largo correcto
          </>
        ) : (
          <>
            <span className="sr-only">Al menos 10 caracteres. </span>
            <span aria-hidden>
              {length} de {MIN} caracteres
            </span>
          </>
        )}
      </span>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [length, setLength] = useState(0);
  const [pending, setPending] = useState(false);
  const [formRef, shake] = useShake<HTMLFormElement>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    if (password.length < MIN) {
      setPasswordError("La contraseña debe tener al menos 10 caracteres.");
      return shake();
    }
    setPasswordError(null);
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")).trim(),
      email,
      password,
      callbackURL: "/w",
    });
    if (error) {
      setPending(false);
      setError(authErrorMessage(error));
      return shake();
    }
    router.push(`/verificar?email=${encodeURIComponent(email)}`);
  }

  return (
    <>
      <AuthHeading title="Empezá por tu marca.">Creá tu cuenta. Después configurás el workspace de tu empresa e invitás a tu equipo.</AuthHeading>
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="animate-enter" style={enterAt(4)}>
          <Field id="name" label="Nombre">
            <Input id="name" name="name" variant="filled" autoComplete="name" required maxLength={80} autoFocus />
          </Field>
        </div>
        <div className="animate-enter" style={enterAt(5)}>
          <Field id="email" label="Email de trabajo">
            <Input id="email" name="email" type="email" variant="filled" autoComplete="email" required placeholder="vos@empresa.com" />
          </Field>
        </div>
        <div className="animate-enter" style={enterAt(6)}>
          <label htmlFor="password" className="mb-1.5 block text-small font-medium text-ink">
            Contraseña
          </label>
          <PasswordInput
            id="password"
            name="password"
            variant="filled"
            autoComplete="new-password"
            minLength={MIN}
            required
            onChange={(e) => {
              setLength(e.target.value.length);
              if (passwordError && e.target.value.length >= MIN) setPasswordError(null);
            }}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? "password-error" : "password-hint"}
          />
          <LengthMeter length={length} invalid={Boolean(passwordError)} />
          {passwordError ? (
            <p id="password-error" className="animate-rise-in mt-1.5 text-small text-danger">
              {passwordError}
            </p>
          ) : null}
        </div>
        <div className="animate-enter mt-2" style={enterAt(7)}>
          <Button type="submit" size="lg" loading={pending} className="w-full">
            {pending ? "Creando cuenta" : "Crear cuenta"}
          </Button>
        </div>
      </form>
    </>
  );
}
