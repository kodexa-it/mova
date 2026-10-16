// Procesa la cola de tareas en segundo plano (generación de la estrategia
// semanal) mientras corre. Uso local: `npm run worker`. Corta con Ctrl+C.
import "dotenv/config";

import { runPendingJobs } from "../modules/jobs/run";

console.info("[worker] procesando la cola de tareas (Ctrl+C para salir)");
let stop = false;
process.on("SIGINT", () => (stop = true));
while (!stop) {
  const ran = await runPendingJobs({ deadlineMs: 50_000 });
  if (ran) console.info(`[worker] ${ran} tarea(s)`);
  await new Promise((r) => setTimeout(r, 5_000));
}
process.exit(0);
