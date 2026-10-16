import type { Metadata } from "next";

import { AuthHeading } from "../auth-heading";
import { ResendVerification } from "./resend-verification";

export const metadata: Metadata = { title: "Confirmá tu email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <>
      <AuthHeading title="Confirmá tu email">
        Te enviamos un enlace{email ? <> a <span className="font-medium text-ink">{email}</span></> : null}. Abrilo para
        confirmar tu cuenta; vence en 24 horas.
      </AuthHeading>
      <p className="-mt-4 mb-8 text-small text-ink-2">
        Hasta confirmarlo podés iniciar sesión, pero no crear un workspace ni aceptar invitaciones.
      </p>
      <ResendVerification defaultEmail={email ?? ""} />
    </>
  );
}
