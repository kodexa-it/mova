"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, useConfirm, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

export function ArchiveButton({ slug, itemId, archived }: { slug: string; itemId: string; archived: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [pending, setPending] = useState(false);

  async function run() {
    if (!archived) {
      const ok = await confirm({ title: "¿Archivar esta pieza?", description: "Sale del calendario y de la lista. Podés restaurarla después.", confirmLabel: "Archivar" });
      if (!ok) return;
    }
    setPending(true);
    const result = await apiRequest(`/api/w/${slug}/content/${itemId}/archive`, { method: "POST", body: { archived: !archived } });
    setPending(false);
    if (!result.ok) return toast.error(result.message);
    toast.success(archived ? "Pieza restaurada" : "Pieza archivada");
    router.refresh();
  }

  return (
    <>
      {dialog}
      <Button variant="secondary" size="sm" loading={pending} onClick={run}>
        {archived ? "Restaurar" : "Archivar"}
      </Button>
    </>
  );
}
