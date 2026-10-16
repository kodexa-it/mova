import type { Metadata } from "next";

import { Card, CardHeader, PageHeader } from "@/components/ui";
import { requirePageWorkspace } from "@/lib/page-context";

import { DeleteWorkspace, RenameWorkspace } from "./settings-forms";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requirePageWorkspace(slug, "workspace.update");

  return (
    <>
      <PageHeader title="Configuración" description="Datos del workspace. Solo los Dueños pueden cambiarlos." />
      <div className="flex max-w-2xl flex-col gap-6">
        <Card className="p-6">
          <CardHeader title="Nombre" />
          <RenameWorkspace slug={slug} name={ctx.workspace.name} />
        </Card>
        <Card tone="danger" className="p-6">
          <CardHeader
            title="Eliminar el workspace"
            description="Nadie va a poder volver a entrar y se anulan las invitaciones pendientes. El registro de auditoría se conserva."
          />
          <DeleteWorkspace slug={slug} name={ctx.workspace.name} />
        </Card>
      </div>
    </>
  );
}
