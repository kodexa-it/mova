"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Notice, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  return (
    <div className="flex flex-col gap-4">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        type="button"
        loading={pending}
        className="w-full"
        onClick={async () => {
          setPending(true);
          const result = await apiRequest<{ workspace: { slug: string; name?: string } }>("/api/invitations/accept", {
            method: "POST",
            body: { token },
          });
          if (!result.ok) {
            setPending(false);
            return setError(result.message);
          }
          toast.success(result.data.workspace.name ? `Te sumaste a ${result.data.workspace.name}` : "Te sumaste al workspace");
          router.push(`/w/${result.data.workspace.slug}`);
        }}
      >
        {pending ? "Aceptando" : "Aceptar invitación"}
      </Button>
    </div>
  );
}
