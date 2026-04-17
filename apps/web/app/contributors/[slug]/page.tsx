import { notFound } from "next/navigation";

import { getPublicProfileBySlug } from "@/lib/account-service";

export const dynamic = "force-dynamic";

export default async function ContributorProfilePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  return (
    <div className="detail-layout">
      <section className="detail-panel">
        <p className="eyebrow">Perfil público</p>
        <h2>{profile.displayName}</h2>
        <p>{profile.bio ?? "Sin biografía pública."}</p>
        <div className="metric-row">
          <span>{profile.role}</span>
          <span>{profile.affiliation ?? "Sin afiliación"}</span>
          <span>{profile.contributionCount} contribuciones</span>
        </div>
      </section>

      <aside className="detail-panel">
        <p className="eyebrow">Historial</p>
        <h2>Actividad aprobada</h2>
        <p>{profile.approvedContributionCount} contribuciones aprobadas.</p>
        <p>Se unió el {new Date(profile.joinedAt).toLocaleDateString()}.</p>
      </aside>
    </div>
  );
}
