import Link from "next/link";
import { redirect } from "next/navigation";

import { getAccountByAuthUserId, updateMyProfile } from "@/lib/account-service";
import { requireSession } from "@/lib/server-session";
import { listMySubmissions } from "@/lib/submissions-service";
import { SubmissionWorkbench } from "@/components/submission-workbench";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireSession();
  const [account, submissions] = await Promise.all([
    getAccountByAuthUserId(session.user.id),
    listMySubmissions(session.accountId)
  ]);

  if (!account) {
    redirect("/");
  }

  async function saveProfileAction(formData: FormData) {
    "use server";

    await updateMyProfile({
      accountId: session.accountId,
      actorAccountId: session.accountId,
      displayName: String(formData.get("displayName") ?? ""),
      bio: String(formData.get("bio") ?? "") || null,
      affiliation: String(formData.get("affiliation") ?? "") || null,
      avatarUrl: String(formData.get("avatarUrl") ?? "") || null
    });

    redirect("/account");
  }

  return (
    <div className="detail-layout">
      <section className="detail-panel">
        <p className="eyebrow">Perfil</p>
        <h2>{account.display_name ?? session.user.name}</h2>
        <div className="metric-row">
          <span>{session.user.role}</span>
          <span>{session.user.emailVerified ? "Correo verificado" : "Correo pendiente"}</span>
          {session.user.slug ? (
            <Link href={`/contributors/${session.user.slug}`}>Perfil público</Link>
          ) : null}
        </div>
        <form action={saveProfileAction} className="search-form">
          <input
            defaultValue={account.display_name ?? ""}
            name="displayName"
            placeholder="Nombre público"
            required
          />
          <input
            defaultValue={account.affiliation ?? ""}
            name="affiliation"
            placeholder="Afiliación"
          />
          <input
            defaultValue={account.avatar_url ?? ""}
            name="avatarUrl"
            placeholder="URL de avatar"
            type="url"
          />
          <textarea defaultValue={account.bio ?? ""} name="bio" placeholder="Biografía" />
          <button type="submit">Guardar perfil</button>
        </form>
      </section>

      <aside className="detail-panel">
        <p className="eyebrow">Estado</p>
        <h2>Cuenta y gobierno</h2>
        <p>Contribuciones enviadas: {account.contribution_count}</p>
        <p>Aprobadas: {account.approved_contribution_count}</p>
        <p>Trust score interno: {account.trust_score}</p>
      </aside>

      {session.user.emailVerified ? (
        <SubmissionWorkbench initialSubmissions={submissions} />
      ) : (
        <section className="detail-panel">
          <p className="eyebrow">Verificación pendiente</p>
          <h2>Verifica tu correo antes de contribuir</h2>
          <p>
            Cuando el correo esté verificado, aquí aparecerán los formularios de
            observación, corrección y sugerencias editoriales.
          </p>
        </section>
      )}
    </div>
  );
}
