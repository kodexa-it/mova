// Convierte un nombre en un slug de URL: minúsculas, sin acentos, solo
// letras, números y guiones, entre 3 y 40 caracteres.
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : `workspace${base ? `-${base}` : ""}`;
}

export const RESERVED_SLUGS = new Set(["nuevo", "api", "admin", "configuracion", "invitacion"]);

export function withSuffix(slug: string, suffix: string): string {
  return `${slug.slice(0, 40 - suffix.length - 1)}-${suffix}`;
}
