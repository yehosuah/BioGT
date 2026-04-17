import { requireRole } from "@/lib/server-session";
import { listModerationQueue } from "@/lib/submissions-service";

export async function GET(request: Request) {
  await requireRole("moderator");
  const url = new URL(request.url);

  return Response.json({
    items: await listModerationQueue({
      submissionType: url.searchParams.get("submissionType") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      sourceTier: url.searchParams.get("sourceTier") ?? undefined,
      hasConflict:
        url.searchParams.get("hasConflict") === null
          ? undefined
          : url.searchParams.get("hasConflict") === "true"
    })
  });
}
