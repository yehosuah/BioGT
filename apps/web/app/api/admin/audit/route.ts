import { requireRole } from "@/lib/server-session";
import { listAuditEvents } from "@/lib/submissions-service";

export async function GET() {
  await requireRole("admin");
  return Response.json({
    events: await listAuditEvents()
  });
}
