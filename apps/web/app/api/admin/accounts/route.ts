import { listAdminAccounts } from "@/lib/account-service";
import { requireRole } from "@/lib/server-session";

export async function GET() {
  await requireRole("admin");
  return Response.json({
    accounts: await listAdminAccounts()
  });
}
