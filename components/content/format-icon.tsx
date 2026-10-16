import type { ReactNode } from "react";

import type { Format } from "@/modules/content/formats";

const PATHS: Record<Format, ReactNode> = {
  FEED_IMAGE: (
    <>
      <rect x="3" y="3" width="10" height="10" rx="2" />
      <path d="m3.5 11 3-3 2 2 1.5-1.5 2.5 2.5" />
    </>
  ),
  CAROUSEL: (
    <>
      <rect x="2.5" y="4" width="8" height="9" rx="1.5" />
      <path d="M12.5 5v7M14.5 6v5" />
    </>
  ),
  REEL: (
    <>
      <rect x="4" y="2" width="8" height="12" rx="2" />
      <path d="m7 6.25 3 1.75-3 1.75z" fill="currentColor" stroke="none" />
    </>
  ),
  STORY: (
    <>
      <rect x="4.5" y="2" width="7" height="12" rx="1.75" />
      <path d="M6.5 4.25h3" />
    </>
  ),
};

export function FormatIcon({ format, className = "size-4" }: { format: Format; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[format]}
    </svg>
  );
}
