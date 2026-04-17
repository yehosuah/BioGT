import { listMySubmissions } from "@/lib/submissions-service";
import { requireSession } from "@/lib/server-session";

export async function GET() {
  const session = await requireSession();
  return Response.json({
    submissions: await listMySubmissions(session.accountId)
  });
}
