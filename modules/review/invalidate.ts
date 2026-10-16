import "server-only";

import type { Prisma } from "@prisma/client";

import type { Format } from "@/modules/content/formats";
import { slotsOf } from "@/modules/content/layouts";
import { pieceVisualHash } from "@/modules/content/render/fingerprint";
import { visualContextOf } from "@/modules/content/render/visual";
import type { StaleReason } from "@/modules/review/approval";

type Tx = Prisma.TransactionClient;

// Deja sin efecto las aprobaciones vigentes de una o varias piezas. Se llama en
// la misma transacción que el cambio que las invalida.
export async function invalidateApprovals(tx: Tx, itemIds: string[], reason: StaleReason) {
  if (!itemIds.length) return 0;
  const result = await tx.approvalDecision.updateMany({
    where: { itemId: { in: itemIds }, outcome: "APPROVED", invalidatedAt: null },
    data: { invalidatedAt: new Date(), invalidReason: reason },
  });
  return result.count;
}

// Después de cambiar la paleta, el nombre o el sitio de la marca: las piezas
// aprobadas cuyas imágenes cambian vuelven a revisión (su texto no cambió). La
// huella se calcula por pieza: el sitio solo cuenta si la pieza lo dibuja. Si
// la apariencia vuelve a ser exactamente la aprobada, la aprobación sigue.
export async function invalidateForVisualChange(tx: Tx, workspaceId: string) {
  const visual = await visualContextOf(tx, workspaceId);
  const approvals = await tx.approvalDecision.findMany({
    where: { workspaceId, outcome: "APPROVED", invalidatedAt: null, item: { status: { in: ["APPROVED", "SCHEDULED"] } } },
    select: { itemId: true, visualHash: true, item: { select: { format: true } }, version: { select: { content: true } } },
  });
  const stale = approvals.filter((d) => d.visualHash !== pieceVisualHash(d.item.format, d.version.content, visual));
  const itemIds = [...new Set(stale.map((d) => d.itemId))];
  if (!itemIds.length) return [];
  await invalidateApprovals(tx, itemIds, "visual_changed");
  await tx.contentItem.updateMany({ where: { id: { in: itemIds }, workspaceId }, data: { status: "PENDING_APPROVAL" } });
  return itemIds;
}

// Después de editar los datos publicables: una pieza aprobada que muestra un
// dato ("Dato grande") que ya no está igual en la lista vuelve a revisión.
export async function invalidateForProofChange(tx: Tx, workspaceId: string) {
  const brand = await tx.brand.findUnique({ where: { workspaceId }, select: { proofs: { select: { statement: true } } } });
  // Por texto: guardar la sección de datos recrea los ids aunque nada cambie.
  const current = new Set((brand?.proofs ?? []).map((p) => p.statement));
  const approvals = await tx.approvalDecision.findMany({
    where: { workspaceId, outcome: "APPROVED", invalidatedAt: null, item: { status: { in: ["APPROVED", "SCHEDULED"] } } },
    select: { itemId: true, item: { select: { format: true } }, version: { select: { content: true } } },
  });
  const stale = approvals.filter((d) =>
    slotsOf(d.item.format as Format, d.version.content as Record<string, unknown>).some(
      (s) => s.design?.layout === "stat" && s.design.proof && !current.has(s.design.proof.statement),
    ),
  );
  const itemIds = [...new Set(stale.map((d) => d.itemId))];
  if (!itemIds.length) return [];
  await invalidateApprovals(tx, itemIds, "proof_changed");
  await tx.contentItem.updateMany({ where: { id: { in: itemIds }, workspaceId }, data: { status: "PENDING_APPROVAL" } });
  return itemIds;
}
