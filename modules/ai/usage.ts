import "server-only";

import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { monthlySpendMicros, monthStart } from "@/modules/ai/gateway";

export async function getAiUsage(ctx: WorkspaceContext) {
  requirePermission(ctx, "usage.read");
  const prisma = getPrisma();
  const [workspace, spent, calls] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspace.id }, select: { aiMonthlyBudgetMicros: true } }),
    monthlySpendMicros(ctx.workspace.id),
    prisma.llmCall.findMany({
      where: { workspaceId: ctx.workspace.id, createdAt: { gte: monthStart() } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        operation: true,
        model: true,
        status: true,
        inputTokens: true,
        outputTokens: true,
        costMicros: true,
        durationMs: true,
        errorCode: true,
        createdAt: true,
        userId: true,
      },
    }),
  ]);
  return { budgetMicros: workspace.aiMonthlyBudgetMicros, spentMicros: spent, monthStart: monthStart(), calls };
}
