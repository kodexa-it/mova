"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, Field, Input, Notice } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    const result = await apiRequest<{ workspace: { slug: string } }>("/api/workspaces", { method: "POST", body: { name } });
    if (!result.ok) {
      setPending(false);
      return setError(result.message);
    }
    router.push(`/w/${result.data.workspace.slug}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field id="name" label="Nombre de la empresa">
            <Input id="name" name="name" required minLength={2} maxLength={80} placeholder="Por ejemplo, Estudio Norte" />
          </Field>
        </div>
        <Button type="submit" loading={pending}>
          {pending ? "Creando" : "Crear workspace"}
        </Button>
      </div>
    </form>
  );
}
