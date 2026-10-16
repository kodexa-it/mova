import { timingSafeEqual } from "node:crypto";

import { getEnv } from "@/lib/env";
import { handle, json, unauthorized } from "@/lib/http";
import { runPendingJobs } from "@/modules/jobs/run";

export const runtime = "nodejs";
export const maxDuration = 60;

// Ejecuta la cola de tareas. Lo llama un programador (función programada de
// Netlify) con "Authorization: Bearer <CRON_SECRET>". Sin secreto configurado,
// queda cerrado.
export const POST = handle(async (request: Request) => {
  const secret = getEnv().CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) throw unauthorized();
  return json({ ran: await runPendingJobs({ deadlineMs: 50_000 }) });
});
