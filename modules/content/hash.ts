import { createHash } from "node:crypto";

// JSON con las claves ordenadas: el mismo contenido da siempre el mismo hash.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function contentHash(content: unknown): string {
  return createHash("sha256").update(canonical(content)).digest("hex");
}
