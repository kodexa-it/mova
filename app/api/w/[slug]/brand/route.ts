import { handle, json } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { brandProgress } from "@/modules/brand/completeness";
import { getBrand, shapeOf } from "@/modules/brand/service";

type Params = { params: Promise<{ slug: string }> };

export const GET = handle(async (request: Request, { params }: Params) => {
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  const brand = await getBrand(ctx);
  return json({ brand, progress: brandProgress(shapeOf(brand)) });
});
