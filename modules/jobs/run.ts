import "server-only";

import { after } from "next/server";

import { runJobs } from "@/modules/jobs/queue";
import { onGenerateSettled, STRATEGY_HANDLERS } from "@/modules/plans/strategy";

// Ejecuta las tareas pendientes de todos los tipos conocidos.
export function runPendingJobs(options: { deadlineMs?: number; limit?: number } = {}) {
  return runJobs({ handlers: { ...STRATEGY_HANDLERS }, onSettled: onGenerateSettled, ...options });
}

// Después de responder, sigue procesando la cola en el mismo servidor (en
// local alcanza; en un despliegue, además, corre el programador). En los tests
// no se dispara sola: cada test ejecuta la cola cuando la necesita.
export function kickJobs() {
  if (process.env.NODE_ENV === "test") return;
  try {
    after(() => runPendingJobs({ deadlineMs: 55_000 }).then(() => undefined).catch((error: unknown) => console.error(`[tareas] ${error instanceof Error ? error.message : "error"}`)));
  } catch {
    void runPendingJobs({ deadlineMs: 55_000 }).catch(() => undefined);
  }
}
