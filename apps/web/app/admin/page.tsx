import { redirect } from "next/navigation";

import { listAdminAccounts, updateAccountRole, updateAccountTrust } from "@/lib/account-service";
import { requireRole } from "@/lib/server-session";
import { listAuditEvents } from "@/lib/submissions-service";

export const dynamic = "force-dynamic";

type AdminAccount = Awaited<ReturnType<typeof listAdminAccounts>>[number];
type AuditEvent = Awaited<ReturnType<typeof listAuditEvents>>[number];

export default async function AdminPage() {
  const session = await requireRole("admin");
  const [accounts, events] = await Promise.all([listAdminAccounts(), listAuditEvents()]);

  async function updateRoleAction(formData: FormData) {
    "use server";

    await updateAccountRole({
      accountId: String(formData.get("accountId") ?? ""),
      actorAccountId: session.accountId,
      role: String(formData.get("role") ?? "member") as
        | "member"
        | "contributor"
        | "moderator"
        | "admin"
    });

    redirect("/admin");
  }

  async function updateTrustAction(formData: FormData) {
    "use server";

    const trustFlags = String(formData.get("trustFlags") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    await updateAccountTrust({
      accountId: String(formData.get("accountId") ?? ""),
      actorAccountId: session.accountId,
      trustScore: Number(formData.get("trustScore") ?? 0),
      trustFlags
    });

    redirect("/admin");
  }

  return (
    <div className="detail-layout">
      <section className="detail-panel">
        <p className="eyebrow">Cuentas</p>
        <h2>Roles y trust</h2>
        <div className="grid-two">
          {accounts.map((account: AdminAccount) => (
            <article className="entity-card" key={account.id}>
              <h3>{account.display_name ?? account.slug ?? account.id}</h3>
              <p>{account.email ?? "sin correo"}</p>
              <form action={updateRoleAction} className="search-form">
                <input name="accountId" type="hidden" value={account.id} />
                <select defaultValue={account.role} name="role">
                  <option value="member">member</option>
                  <option value="contributor">contributor</option>
                  <option value="moderator">moderator</option>
                  <option value="admin">admin</option>
                </select>
                <button type="submit">Guardar rol</button>
              </form>
              <form action={updateTrustAction} className="search-form">
                <input name="accountId" type="hidden" value={account.id} />
                <input defaultValue={account.trust_score} name="trustScore" type="number" />
                <input
                  defaultValue={(account.trust_flags ?? []).join(", ")}
                  name="trustFlags"
                  placeholder="flags separadas por coma"
                />
                <button type="submit">Guardar trust</button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <aside className="detail-panel">
        <p className="eyebrow">Auditoría</p>
        <h2>Eventos recientes</h2>
        <div className="grid-two">
          {events.slice(0, 24).map((event: AuditEvent) => (
            <article className="entity-card" key={event.id}>
              <p className="entity-card-eyebrow">{event.eventType}</p>
              <h3>{event.entityType}</h3>
              <p>{event.entityRef}</p>
              <p>{new Date(event.createdAt).toLocaleString()}</p>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
