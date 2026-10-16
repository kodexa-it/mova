"use client";

import type { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, Field, Input, Notice, Select, useConfirm, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";
import { ROLE_LABELS, ROLES } from "@/modules/access/permissions";

const ROLE_HINTS: Record<Role, string> = {
  OWNER: "Administra el workspace, sus integrantes y toda la configuración.",
  EDITOR: "Crea y modifica contenido y propuestas de estrategia.",
  APPROVER: "Revisa, pide cambios y aprueba contenido.",
  VIEWER: "Consulta la información sin modificarla.",
};

// Errores junto al control que los causó; confirmaciones de éxito como
// notificación; acciones que no se deshacen, con diálogo de confirmación.

export function InviteForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("EDITOR");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const email = String(new FormData(formElement).get("email")).trim();
    setPending(true);
    setError(null);
    const result = await apiRequest(`/api/w/${slug}/invitations`, { method: "POST", body: { email, role } });
    setPending(false);
    if (!result.ok) return setError(result.message);
    formElement.reset();
    toast.success("Invitación enviada", `${email} tiene 7 días para aceptarla.`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field id="invite-email" label="Email">
          <Input id="invite-email" name="email" type="email" required placeholder="persona@empresa.com" />
        </Field>
        <Field id="invite-role" label="Rol" hint={ROLE_HINTS[role]}>
          <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-describedby="invite-role-hint">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div>
        <Button type="submit" loading={pending}>
          {pending ? "Enviando" : "Enviar invitación"}
        </Button>
      </div>
    </form>
  );
}

export function MemberActions({ slug, membershipId, role, name }: { slug: string; membershipId: string; role: Role; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirm, dialog] = useConfirm();
  const toast = useToast();

  async function changeRole(next: Role) {
    setPending(true);
    setError(null);
    const result = await apiRequest(`/api/w/${slug}/members/${membershipId}`, { method: "PATCH", body: { role: next } });
    setPending(false);
    if (!result.ok) return setError(result.message);
    toast.success("Rol actualizado", `${name} ahora es ${ROLE_LABELS[next]}.`);
    router.refresh();
  }

  async function remove() {
    const ok = await confirm({
      title: `¿Quitar a ${name}?`,
      description: "Pierde el acceso al workspace de inmediato. Para volver va a necesitar una invitación nueva.",
      confirmLabel: "Quitar del workspace",
      tone: "danger",
    });
    if (!ok) return;
    setPending(true);
    setError(null);
    const result = await apiRequest(`/api/w/${slug}/members/${membershipId}`, { method: "DELETE" });
    setPending(false);
    if (!result.ok) return setError(result.message);
    toast.success(`Quitaste a ${name}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {dialog}
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`role-${membershipId}`}>
          Rol de {name}
        </label>
        <div className="w-40">
          <Select
            id={`role-${membershipId}`}
            value={role}
            disabled={pending}
            onChange={(e) => changeRole(e.target.value as Role)}
            controlSize="sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="quiet" size="sm" type="button" onClick={remove} disabled={pending}>
          Quitar
        </Button>
      </div>
      {error ? (
        <p role="alert" className="max-w-xs text-right text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LeaveButton({ slug, membershipId }: { slug: string; membershipId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirm, dialog] = useConfirm();

  async function leave() {
    const ok = await confirm({
      title: "¿Salir de este workspace?",
      description: "Vas a dejar de verlo de inmediato. Para volver vas a necesitar una invitación nueva.",
      confirmLabel: "Salir",
      tone: "danger",
    });
    if (!ok) return;
    setPending(true);
    const result = await apiRequest(`/api/w/${slug}/members/${membershipId}`, { method: "DELETE" });
    if (!result.ok) {
      setPending(false);
      return setError(result.message);
    }
    router.push("/w");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {dialog}
      <Button variant="quiet" size="sm" type="button" onClick={leave} loading={pending}>
        Salir del workspace
      </Button>
      {error ? (
        <p role="alert" className="max-w-xs text-right text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RevokeInvitationButton({ slug, invitationId, email }: { slug: string; invitationId: string; email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirm, dialog] = useConfirm();
  const toast = useToast();
  return (
    <div className="flex flex-col items-end gap-1">
      {dialog}
      <Button
        variant="quiet"
        size="sm"
        type="button"
        loading={pending}
        onClick={async () => {
          const ok = await confirm({
            title: "¿Anular la invitación?",
            description: `El enlace enviado a ${email} deja de funcionar.`,
            confirmLabel: "Anular invitación",
            tone: "danger",
          });
          if (!ok) return;
          setPending(true);
          const result = await apiRequest(`/api/w/${slug}/invitations/${invitationId}`, { method: "DELETE" });
          setPending(false);
          if (!result.ok) return setError(result.message);
          toast.success("Invitación anulada");
          router.refresh();
        }}
      >
        Anular invitación
      </Button>
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
