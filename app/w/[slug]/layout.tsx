import type { ReactNode } from "react";

import { AppHeader } from "@/components/app/app-header";
import { requirePageWorkspace } from "@/lib/page-context";
import { can } from "@/modules/access/permissions";
import { unreadCount } from "@/modules/notifications/service";
import { listWorkspacesForUser } from "@/modules/workspaces/service";

import { WorkspaceNav, type NavItem } from "./workspace-nav";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requirePageWorkspace(slug);
  const [workspaces, unread] = await Promise.all([listWorkspacesForUser(ctx.user.id), unreadCount(ctx)]);
  const items: NavItem[] = [
    { href: `/w/${slug}`, label: "Inicio", icon: "home" },
    { href: `/w/${slug}/calendario`, label: "Calendario", icon: "calendar" },
    { href: `/w/${slug}/contenido`, label: "Contenido", icon: "content" },
    { href: `/w/${slug}/resultados`, label: "Resultados", icon: "chart" },
    { href: `/w/${slug}/marca`, label: "Marca", icon: "brand" },
    { href: `/w/${slug}/integrantes`, label: "Integrantes", icon: "people" },
    ...(can(ctx.role, "workspace.update") ? [{ href: `/w/${slug}/configuracion`, label: "Configuración", icon: "settings" } as const] : []),
    ...(can(ctx.role, "usage.read") ? [{ href: `/w/${slug}/uso`, label: "Uso de IA", icon: "spark" } as const] : []),
    ...(can(ctx.role, "audit.read") ? [{ href: `/w/${slug}/auditoria`, label: "Auditoría", icon: "audit" } as const] : []),
  ];

  return (
    <div className="min-h-dvh">
      <AppHeader
        user={{ name: ctx.user.name, email: ctx.user.email }}
        current={{ slug, name: ctx.workspace.name, role: ctx.role }}
        workspaces={workspaces.map((ws) => ({ slug: ws.slug, name: ws.name, role: ws.role }))}
        unread={unread}
      />
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-5 py-8 sm:px-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-12 md:py-12">
        <WorkspaceNav items={items} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
