import "server-only";

import type { Job, Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";

// Cola de tareas en PostgreSQL (sin servicios extra). Una tarea se toma con
// FOR UPDATE SKIP LOCKED: dos procesos nunca ejecutan la misma. Si el proceso
// muere a mitad de una tarea, el lock vence a los LOCK_MINUTES y otro la retoma
// (cuenta como un intento más).
export const LOCK_MINUTES = 10;

export type JobHandler = (job: Job) => Promise<Prisma.InputJsonValue | void>;

// Error que no vale la pena reintentar (falta configuración, sin permiso,
// sin presupuesto): la tarea falla al primer intento.
export class PermanentJobError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export async function enqueue(
  tx: Pick<Prisma.TransactionClient, "job">,
  input: { workspaceId: string; kind: string; payload: Prisma.InputJsonValue; groupKey?: string; createdById?: string | null; maxAttempts?: number },
) {
  return tx.job.create({
    data: { workspaceId: input.workspaceId, kind: input.kind, payload: input.payload, groupKey: input.groupKey ?? null, createdById: input.createdById ?? null, maxAttempts: input.maxAttempts ?? 2 },
    select: { id: true },
  });
}

async function claim(): Promise<Job | null> {
  const rows = await getPrisma().$queryRaw<Job[]>`
    UPDATE "Job" SET "status" = 'RUNNING', "lockedAt" = now(), "attempts" = "attempts" + 1
    WHERE "id" = (
      SELECT "id" FROM "Job"
      WHERE ("status" = 'QUEUED' AND "runAfter" <= now())
         OR ("status" = 'RUNNING' AND "lockedAt" < now() - make_interval(mins => ${LOCK_MINUTES}))
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
  return rows[0] ?? null;
}

export interface RunOptions {
  handlers: Record<string, JobHandler>;
  // Corta antes de tomar otra tarea si pasó este tiempo (funciones con límite).
  deadlineMs?: number;
  limit?: number;
  // Se llama después de cada tarea terminada (bien o mal), con su grupo.
  onSettled?: (job: Job) => Promise<void>;
}

export async function runJobs({ handlers, deadlineMs = 50_000, limit = 50, onSettled }: RunOptions) {
  const started = Date.now();
  let done = 0;
  while (done < limit && Date.now() - started < deadlineMs) {
    const job = await claim();
    if (!job) break;
    done += 1;
    const handler = handlers[job.kind];
    const prisma = getPrisma();
    try {
      if (!handler) throw new PermanentJobError("unknown_kind");
      const result = await handler(job);
      await prisma.job.update({ where: { id: job.id }, data: { status: "SUCCEEDED", finishedAt: new Date(), lockedAt: null, ...(result !== undefined ? { result } : {}) } });
    } catch (error) {
      const code = error instanceof PermanentJobError ? error.code : error instanceof Error ? (error as { code?: string }).code ?? error.message : "error";
      const retry = !(error instanceof PermanentJobError) && job.attempts < job.maxAttempts;
      console.error(`[tareas] ${job.kind} ${job.id} falló (intento ${job.attempts}): ${String(code).slice(0, 200)}`);
      await prisma.job.update({
        where: { id: job.id },
        data: retry
          ? { status: "QUEUED", lockedAt: null, lastError: String(code).slice(0, 300), runAfter: new Date(Date.now() + 30_000 * job.attempts) }
          : { status: "FAILED", lockedAt: null, lastError: String(code).slice(0, 300), finishedAt: new Date() },
      });
      if (retry) continue;
    }
    if (onSettled) await onSettled(job).catch((error) => console.error(`[tareas] aviso de ${job.id} falló: ${error instanceof Error ? error.message : "error"}`));
  }
  return done;
}
