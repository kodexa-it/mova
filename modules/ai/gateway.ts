import "server-only";

import type { Prisma } from "@prisma/client";

import { HttpError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import type { WorkspaceContext } from "@/modules/access/context";
import { costMicros, estimateMaxMicros, hasPrice } from "@/modules/ai/pricing";
import { getProvider, modelFor } from "@/modules/ai/providers/registry";
import { AiProviderError, type AiMessage } from "@/modules/ai/providers/types";

export const aiNotConfigured = () => new HttpError(503, "ai_not_configured");
export const aiCreditsExhausted = () => new HttpError(402, "ai_credits_exhausted");
// Lo que ve la persona según qué falló del lado del proveedor.
const PUBLIC_CODES: Record<string, string> = {
  provider_auth: "ai_auth",
  provider_no_credits: "ai_no_credits",
  provider_rejected: "ai_rejected",
  provider_model_not_found: "ai_rejected",
  provider_rate_limited: "ai_rate_limited",
};
export const aiFailed = (providerCode?: string) => new HttpError(502, (providerCode && PUBLIC_CODES[providerCode]) || "ai_failed");

export interface GatewayRequest {
  operation: string;
  tier: "fast" | "smart";
  system: string;
  messages: AiMessage[];
  maxTokens: number;
}

export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// Gasto del mes: costo real de lo terminado más lo reservado por lo pendiente.
export async function monthlySpendMicros(workspaceId: string, db: Pick<Prisma.TransactionClient, "llmCall"> = getPrisma()): Promise<number> {
  const rows = await db.llmCall.groupBy({
    by: ["status"],
    where: { workspaceId, createdAt: { gte: monthStart() } },
    _sum: { costMicros: true, reservedMicros: true },
  });
  return rows.reduce((total, row) => total + (row.status === "PENDING" ? row._sum.reservedMicros ?? 0 : row._sum.costMicros ?? 0), 0);
}

// Única puerta a los modelos. Orden:
// 1. Sin proveedor configurado, 503 sin registrar nada.
// 2. Bajo un lock por workspace, compara el gasto del mes más el costo máximo
//    de esta llamada contra el presupuesto. Si no alcanza, registra BLOCKED y
//    corta ANTES de llamar al modelo. Si alcanza, reserva ese máximo.
// 3. Llama al proveedor fuera de la transacción y registra el costo real.
export async function runAi(ctx: WorkspaceContext, request: GatewayRequest): Promise<{ text: string; callId: string }> {
  const provider = getProvider();
  if (!provider) throw aiNotConfigured();
  const model = modelFor(request.tier);
  if (!hasPrice(model)) throw aiNotConfigured();

  const inputChars = request.system.length + request.messages.reduce((n, m) => n + m.content.length, 0);
  const reserve = estimateMaxMicros(model, inputChars, request.maxTokens);
  const prisma = getPrisma();
  const base = { workspaceId: ctx.workspace.id, userId: ctx.user.id, operation: request.operation, provider: provider.name, model };

  const reservation = await prisma.$transaction(async (tx) => {
    // Serializa las reservas del mismo workspace: dos pedidos simultáneos no
    // pueden gastar el mismo presupuesto.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-budget:${ctx.workspace.id}`}))`;
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: ctx.workspace.id }, select: { aiMonthlyBudgetMicros: true } });
    const spent = await monthlySpendMicros(ctx.workspace.id, tx);
    if (spent + reserve > workspace.aiMonthlyBudgetMicros) {
      await tx.llmCall.create({ data: { ...base, status: "BLOCKED", errorCode: "credits_exhausted", finishedAt: new Date() } });
      return null;
    }
    return tx.llmCall.create({ data: { ...base, status: "PENDING", reservedMicros: reserve }, select: { id: true } });
  });
  if (!reservation) throw aiCreditsExhausted();

  const started = Date.now();
  try {
    const result = await provider.complete({ model, system: request.system, messages: request.messages, maxTokens: request.maxTokens });
    if (result.truncated) console.warn(`[ia] ${request.operation} con ${model}: la respuesta se cortó en ${request.maxTokens} tokens`);
    await prisma.llmCall.update({
      where: { id: reservation.id },
      data: {
        status: "SUCCEEDED",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costMicros: costMicros(model, result.inputTokens, result.outputTokens),
        durationMs: Date.now() - started,
        finishedAt: new Date(),
      },
    });
    return { text: result.text, callId: reservation.id };
  } catch (error) {
    const code = error instanceof AiProviderError ? error.code : "unexpected";
    console.error(`[ia] ${request.operation} con ${model} falló: ${code}${error instanceof AiProviderError && error.detail ? ` (${error.detail})` : ""}`);
    await prisma.llmCall.update({
      where: { id: reservation.id },
      data: {
        status: "FAILED",
        errorCode: code,
        durationMs: Date.now() - started,
        finishedAt: new Date(),
      },
    });
    throw aiFailed(code);
  }
}

export async function markCallOutputInvalid(callId: string): Promise<void> {
  // La llamada se cobró igual: se conserva el costo y se anota el motivo.
  await getPrisma().llmCall.update({ where: { id: callId }, data: { errorCode: "invalid_output" } });
}
