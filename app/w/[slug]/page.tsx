import Link from "next/link";

import { RoleBadge } from "@/components/app/role-badge";
import { Card, PageHeader } from "@/components/ui";
import { requirePageWorkspace } from "@/lib/page-context";
import { can, type Permission } from "@/modules/access/permissions";
import { brandProgress } from "@/modules/brand/completeness";
import { getBrand, shapeOf } from "@/modules/brand/service";
import { listPendingInvitations } from "@/modules/invitations/service";
import { listMembers } from "@/modules/members/service";

// Lo que cada rol puede hacer, en palabras de quien usa Mova. Sale de la misma
// matriz de permisos que protege el servidor.
const CAPABILITIES: { permission: Permission; text: string }[] = [
  { permission: "brand.update", text: "Configurar la marca" },
  { permission: "content.write", text: "Crear y editar contenido" },
  { permission: "content.approve", text: "Aprobar piezas antes de publicarlas" },
  { permission: "content.comment", text: "Comentar y pedir cambios" },
  { permission: "members.manage", text: "Invitar personas y cambiar roles" },
];

type StepState = "done" | "current" | "locked";

function StepMark({ state, index }: { state: StepState; index: number }) {
  if (state === "done") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success text-white">
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3.75 8.25 2.75 2.75 5.75-6.25" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`tabular grid size-7 shrink-0 place-items-center rounded-full text-caption font-semibold ${
        state === "current" ? "bg-accent text-white shadow-[0_0_0_4px_var(--color-accent-soft)]" : "bg-pearl text-ink-2"
      }`}
    >
      {index}
    </span>
  );
}

export default async function WorkspaceHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requirePageWorkspace(slug);
  const isOwner = can(ctx.role, "members.manage");
  const [members, invitations, brand] = await Promise.all([listMembers(ctx), isOwner ? listPendingInvitations(ctx) : [], getBrand(ctx)]);
  const brandState = brandProgress(shapeOf(brand));
  const firstName = ctx.user.name.split(" ")[0] ?? ctx.user.name;

  const teamDone = members.length > 1 || invitations.length > 0;
  const steps: { title: string; text: string; state: StepState; action?: { href: string; label: string }; note?: string }[] = [
    { title: "Crear el workspace", text: "El espacio de tu empresa en Mova.", state: "done" },
    {
      title: "Sumar al equipo",
      text: teamDone
        ? `${members.length} ${members.length === 1 ? "persona" : "personas"}${invitations.length ? ` y ${invitations.length} ${invitations.length === 1 ? "invitación pendiente" : "invitaciones pendientes"}` : ""}.`
        : "Invitá a quienes van a crear, revisar o aprobar contenido.",
      state: teamDone ? "done" : "current",
      action: !teamDone && isOwner ? { href: `/w/${slug}/integrantes`, label: "Invitar" } : undefined,
    },
    {
      title: "Configurar la marca",
      text: brandState.isComplete
        ? "Identidad, servicios, público, voz, pilares y visual cargados."
        : `Identidad, servicios, público, tono y objetivos. ${brandState.completed} de ${brandState.total} secciones listas.`,
      state: brandState.isComplete ? "done" : "current",
      action: brandState.isComplete
        ? undefined
        : { href: `/w/${slug}/marca${brandState.nextIncomplete ? `/${brandState.nextIncomplete}` : ""}`, label: can(ctx.role, "brand.update") ? (brand ? "Seguir" : "Empezar") : "Ver la marca" },
    },
    {
      title: "Planificar la primera semana",
      text: "Mova propone las piezas; tu equipo las revisa y aprueba antes de publicarlas.",
      state: brandState.isComplete ? "current" : "locked",
      note: "Próxima etapa",
    },
  ];
  const done = steps.filter((step) => step.state === "done").length;

  return (
    <>
      <PageHeader title={`Hola, ${firstName}.`} description={`Así está ${ctx.workspace.name} en Mova.`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <Card className="p-6 sm:p-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lead font-semibold text-ink">Primeros pasos</h2>
              <p className="mt-1 text-small text-ink-2">Lo que falta para tener la primera semana de contenido.</p>
            </div>
            <p className="tabular shrink-0 text-small text-ink-2">
              {done} de {steps.length}
            </p>
          </div>
          <div aria-hidden className="mt-4 flex gap-1">
            {steps.map((step) => (
              <span key={step.title} className={`h-1 flex-1 rounded-full ${step.state === "done" ? "bg-success" : "bg-pearl-strong"}`} />
            ))}
          </div>
          <ol className="mt-6 flex flex-col">
            {steps.map((step, index) => (
              <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
                {index < steps.length - 1 ? <span aria-hidden className="absolute left-[13.5px] top-8 h-[calc(100%-2rem)] w-px bg-line" /> : null}
                <StepMark state={step.state} index={index + 1} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className={`font-medium ${step.state === "locked" ? "text-ink-2" : "text-ink"}`}>{step.title}</p>
                    {step.note ? <span className="text-caption text-ink-2">{step.note}</span> : null}
                    <span className="sr-only">{step.state === "done" ? "(hecho)" : step.state === "current" ? "(siguiente)" : "(más adelante)"}</span>
                  </div>
                  <p className="mt-0.5 text-small text-ink-2">{step.text}</p>
                  {step.action ? (
                    <Link
                      href={step.action.href}
                      className="mt-3 inline-flex h-8 items-center rounded-[8px] bg-accent px-3 text-small font-medium text-white transition-colors hover:bg-accent-hover"
                    >
                      {step.action.label}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card as="div" className="self-start p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-small font-medium text-ink">Tu rol</h2>
            <RoleBadge role={ctx.role} />
          </div>
          <ul className="mt-4 flex flex-col gap-2.5">
            {CAPABILITIES.map((item) => {
              const allowed = can(ctx.role, item.permission);
              return (
                <li key={item.permission} className={`flex items-start gap-2 text-small ${allowed ? "text-ink" : "text-ink-2 line-through decoration-ink/20"}`}>
                  <svg aria-hidden viewBox="0 0 16 16" className={`mt-0.5 size-3.5 shrink-0 ${allowed ? "text-success" : "text-ink-3"}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {allowed ? <path d="m3.75 8.25 2.75 2.75 5.75-6.25" /> : <path d="M4.5 8h7" />}
                  </svg>
                  <span>
                    <span className="sr-only">{allowed ? "Podés: " : "No podés: "}</span>
                    {item.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
