// Bloque de carga. Se usa en loading.tsx mientras el servidor responde.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}
