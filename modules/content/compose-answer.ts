import { z } from "zod";

import { breaksRhythm, checkDesign, cleanDesign, DEVICES, ICONS, LAYOUTS, type Design, type ProofSnapshot, type SlotRef } from "@/modules/content/layouts";

// Respuesta esperada de la IA: solo elecciones del catálogo, por posición.
const aiAnswerSchema = z.object({
  slots: z
    .array(
      z.object({
        index: z.number().int().min(0).max(20),
        layout: z.enum(LAYOUTS),
        icons: z.array(z.enum(ICONS)).max(5).optional(),
        device: z.enum(DEVICES).optional(),
        proofId: z.string().max(40).optional(),
      }),
    )
    .max(20),
});

// Convierte la respuesta de la IA en diseños. Cada elección se valida con las
// mismas reglas que el editor; la que no cumple se reemplaza por la sugerencia
// determinista de esa imagen. Devuelve cuántas se reemplazaron.
export function designsFromAnswer(raw: unknown, refs: SlotRef[], proofs: ProofSnapshot[], fallback: (Design | undefined)[]) {
  const parsed = aiAnswerSchema.safeParse(raw);
  if (!parsed.success) return null;
  const byIndex = new Map(parsed.data.slots.map((s) => [s.index, s]));
  let replaced = 0;
  const designs = refs.map((ref, i) => {
    const pick = byIndex.get(ref.index);
    if (!pick) {
      replaced += 1;
      return fallback[i];
    }
    const proof = pick.proofId ? proofs.find((p) => p.id === pick.proofId) : undefined;
    if (pick.layout === "stat" && !proof) {
      replaced += 1;
      return fallback[i];
    }
    const design = cleanDesign({ layout: pick.layout, icons: pick.icons, device: pick.device, proof });
    if (checkDesign(ref.slot, design, { proofs }) !== null) {
      replaced += 1;
      return fallback[i];
    }
    return design;
  });
  // Ritmo: si la IA repite la composición de la imagen anterior (o una segunda
  // frase destacada), esa imagen toma la sugerencia automática o la clásica.
  let quoteUsed = false;
  for (let i = 0; i < designs.length; i++) {
    if (breaksRhythm(designs[i], designs[i - 1], quoteUsed)) {
      replaced += 1;
      designs[i] = breaksRhythm(fallback[i], designs[i - 1], quoteUsed) ? undefined : fallback[i];
    }
    if (designs[i]?.layout === "quote") quoteUsed = true;
  }
  return { designs, replaced };
}
