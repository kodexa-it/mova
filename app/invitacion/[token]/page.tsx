import type { Metadata } from "next";
import Link from "next/link";

import { RoleBadge } from "@/components/app/role-badge";
import { Wordmark } from "@/components/brand/wordmark";
import { Card, Notice } from "@/components/ui";
import { requirePageUser } from "@/lib/page-context";
import { normalizeEmail } from "@/modules/invitations/token";
import { previewInvitation } from "@/modules/invitations/service";

import { AcceptInvitation } from "./accept-invitation";

export const metadata: Metadata = { title: "Invitación" };
export const dynamic = "force-dynamic";

const STATUS_MESSAGES = {
  not_found: "Esta invitación no existe o el workspace ya no está disponible.",
  used: "Esta invitación ya fue usada.",
  revoked: "Esta invitación fue anulada. Pedile a un Dueño del workspace una nueva.",
  expired: "Esta invitación venció. Pedile a un Dueño del workspace que te invite de nuevo.",
} as const;

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requirePageUser(`/invitacion/${token}`);
  const preview = await previewInvitation(token);

  let body;
  if (preview.status !== "valid") {
    body = <Notice tone="error">{STATUS_MESSAGES[preview.status]}</Notice>;
  } else if (normalizeEmail(user.email) !== preview.email) {
    body = (
      <Notice tone="error">
        Esta invitación es para {preview.email} y tu sesión es de {user.email}. Iniciá sesión con la cuenta invitada para aceptarla.
      </Notice>
    );
  } else if (!user.emailVerified) {
    body = (
      <Notice tone="warning">
        Confirmá tu email antes de aceptar la invitación.{" "}
        <Link href={`/verificar?email=${encodeURIComponent(user.email)}`} className="font-medium underline underline-offset-4">
          Reenviar el enlace
        </Link>
      </Notice>
    );
  } else {
    body = (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-pearl/70 px-4 py-3.5">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-surface text-body font-semibold uppercase text-ink-2 shadow-raised"
          >
            {preview.workspaceName.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{preview.workspaceName}</p>
            <p className="mt-0.5 flex items-center gap-2 text-small text-ink-2">
              Tu rol: <RoleBadge role={preview.role} />
            </p>
          </div>
        </div>
        <AcceptInvitation token={token} />
      </div>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Wordmark height={20} className="mb-8" />
        <Card className="p-7">
          <h1 className="text-title font-semibold text-ink">Te invitaron a un workspace</h1>
          <p className="mb-6 mt-1.5 text-body text-ink-2">Al aceptar, vas a ver su contenido según tu rol.</p>
          {body}
        </Card>
      </div>
    </main>
  );
}
