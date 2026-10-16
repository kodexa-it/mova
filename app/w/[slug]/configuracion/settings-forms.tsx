"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, describedBy, Field, Input, Notice, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

const NAME_HINT = "La dirección del workspace no cambia.";

export function RenameWorkspace({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const toast = useToast();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = String(new FormData(event.currentTarget).get("name")).trim();
    setPending(true);
    setError(null);
    const result = await apiRequest(`/api/w/${slug}`, { method: "PATCH", body: { name: next } });
    setPending(false);
    if (!result.ok) return setError(result.message);
    setDirty(false);
    toast.success("Nombre guardado");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field id="ws-name" label="Nombre del workspace" hint={NAME_HINT}>
        <Input
          id="ws-name"
          name="name"
          defaultValue={name}
          required
          minLength={2}
          maxLength={80}
          aria-describedby={describedBy("ws-name", { hint: NAME_HINT })}
          onChange={(e) => setDirty(e.target.value.trim() !== name)}
        />
      </Field>
      <div>
        <Button type="submit" loading={pending} disabled={!dirty}>
          {pending ? "Guardando" : "Guardar nombre"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteWorkspace({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await apiRequest(`/api/w/${slug}`, { method: "DELETE" });
    if (!result.ok) {
      setPending(false);
      return setError(result.message);
    }
    toast.success(`Eliminaste ${name}`);
    router.push("/w");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field id="ws-confirm" label={`Escribí "${name}" para confirmar`}>
        <Input id="ws-confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" />
      </Field>
      <div>
        <Button type="submit" variant="danger" loading={pending} disabled={confirmation !== name}>
          {pending ? "Eliminando" : "Eliminar workspace"}
        </Button>
      </div>
    </form>
  );
}
