import { Skeleton } from "@/components/ui";

// Mientras el servidor resuelve la sección: la forma de la página, sin datos.
export default function Loading() {
  return (
    <div role="status" aria-label="Cargando" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-6 shadow-raised">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
