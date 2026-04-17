import { redirect } from "next/navigation";

import { requireRole } from "@/lib/server-session";
import { getModerationSubmissionDetail, listModerationQueue, reviewSubmission } from "@/lib/submissions-service";

export const dynamic = "force-dynamic";

export default async function ModerationPage({
  searchParams
}: {
  searchParams: Promise<{ submission?: string }>;
}) {
  const session = await requireRole("moderator");
  const { submission } = await searchParams;
  const queue = await listModerationQueue();
  const selectedId = submission ?? queue[0]?.id ?? null;
  const detail = selectedId ? await getModerationSubmissionDetail(selectedId) : null;

  async function reviewAction(formData: FormData) {
    "use server";

    const submissionId = String(formData.get("submissionId") ?? "");
    const decision = String(formData.get("decision") ?? "");
    const notes = String(formData.get("notes") ?? "");

    await reviewSubmission({
      reviewerId: session.accountId,
      actorAccountId: session.accountId,
      submissionId,
      input: {
        decision: decision as "approve" | "reject" | "request_changes",
        notes,
        diff: {}
      }
    });

    redirect(`/moderation?submission=${submissionId}`);
  }

  return (
    <div className="detail-layout">
      <section className="detail-panel">
        <p className="eyebrow">Cola de revisión</p>
        <h2>Moderación y conflictos</h2>
        <div className="grid-two">
          {queue.map((item) => (
            <article className="entity-card" key={item.id}>
              <p className="entity-card-eyebrow">{item.submissionType}</p>
              <h3>{item.title}</h3>
              <p>Estado: {item.status}</p>
              <p>Contribuidor: {item.accountDisplayName ?? "Sin nombre"}</p>
              <p>Trust: {item.contributorTrustScore}</p>
              <a className="entity-card-link" href={`/moderation?submission=${item.id}`}>
                Revisar
              </a>
            </article>
          ))}
        </div>
      </section>

      {detail ? (
        <aside className="detail-panel">
          <p className="eyebrow">Detalle</p>
          <h2>{detail.submission.title}</h2>
          <pre>{JSON.stringify(detail.submission.payload, null, 2)}</pre>
          <p>Archivos: {detail.submission.media.length}</p>
          <p>Conflictos: {detail.conflicts.length}</p>
          <form action={reviewAction} className="search-form">
            <input name="submissionId" type="hidden" value={detail.submission.id} />
            <textarea name="notes" placeholder="Notas de revisión" />
            <button name="decision" type="submit" value="approve">
              Aprobar
            </button>
            <button name="decision" type="submit" value="request_changes">
              Pedir cambios
            </button>
            <button name="decision" type="submit" value="reject">
              Rechazar
            </button>
          </form>
        </aside>
      ) : null}
    </div>
  );
}
