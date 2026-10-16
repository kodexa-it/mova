import type { Metadata } from "next";
import Link from "next/link";

import { Notice } from "@/components/ui";

import { AuthHeading, textLink } from "../auth-heading";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Elegir contraseña nueva" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  if (!token || error) {
    return (
      <>
        <AuthHeading title="El enlace no es válido" />
        <div className="flex flex-col gap-5">
          <Notice tone="error">El enlace venció o ya se usó. Pedí uno nuevo para cambiar tu contraseña.</Notice>
          <Link href="/recuperar" className={`self-start text-small ${textLink}`}>
            Pedir un enlace nuevo
          </Link>
        </div>
      </>
    );
  }
  return <ResetForm token={token} />;
}
