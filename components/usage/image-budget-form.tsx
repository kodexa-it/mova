"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, Input, Notice, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

// Límite mensual de imágenes con IA (solo Dueño). Con 0 no se genera ninguna.
export function ImageBudgetForm({ slug, limitUsd }: { slug: string; limitUsd: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const usd = Number(String(new FormData(event.currentTarget).get("usd") ?? "").replace(",", "."));
    if (!Number.isFinite(usd) || usd < 0 || usd > 500) return setError("Poné un monto entre 0 y 500 dólares.");
    setPending(true);
    setError(null);
    const result = await apiRequest(`/api/w/${slug}/usage/images`, { method: "PUT", body: { usd } });
    setPending(false);
    if (!result.ok) return setError(result.message);
    toast.success("Límite actualizado");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2" noValidate>
      <div>
        <label htmlFor="image-budget" className="mb-1 block text-caption text-ink-2">
          Límite mensual (USD)
        </label>
        <Input id="image-budget" name="usd" inputMode="decimal" defaultValue={String(limitUsd)} className="w-28" aria-invalid={error ? true : undefined} />
      </div>
      <Button type="submit" variant="secondary" loading={pending}>
        Guardar límite
      </Button>
      {error ? (
        <div className="basis-full">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
    </form>
  );
}
