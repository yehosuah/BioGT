import Link from "next/link";
import { notFound } from "next/navigation";

import { AreaCard } from "@/components/area-card";
import { SpeciesCard } from "@/components/species-card";
import { getArea, getAreaSpecies, getEntityCitations, listProtectedAreas } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function AreaPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const area = await getArea(slug);

  if (!area) {
    notFound();
  }

  const [species, protectedAreas, entityCitations] = await Promise.all([
    getAreaSpecies(area.id),
    listProtectedAreas(),
    getEntityCitations(area.id)
  ]);
  const relatedAreas = protectedAreas.filter((entry) => entry.id !== area.id).slice(0, 2);

  return (
    <div className="page-stack">
      <section className="detail-layout">
        <div className="detail-panel">
          <p className="eyebrow">{area.kind === "protected_area" ? "Área protegida" : "Región"}</p>
          <h2>{area.name}</h2>
          <p>{area.summary}</p>
          <div className="metric-row">
            <span>{area.metrics.speciesCount} especies visibles</span>
            <span>{area.metrics.endemicCount} endémicas</span>
            <span>{area.metrics.storyLabel}</span>
            <span>{area.visibility}</span>
          </div>
          <div className="detail-actions">
            <Link className="entity-card-link" href={`/map?region=${area.slug}`}>
              Abrir en el mapa
            </Link>
          </div>
        </div>

        <aside className="detail-panel">
          <p className="eyebrow">Lectura territorial</p>
          <h2>Una región es una puerta de entrada, no una página vacía</h2>
          <p>
            La ficha combina resumen territorial, riqueza visible y una lista accionable de especies
            para continuar explorando hacia mapa o fichas taxonómicas.
          </p>
        </aside>
      </section>

      <section className="detail-layout">
        <div className="detail-panel">
          <div className="home-section-head">
            <div>
              <p className="eyebrow">Especies visibles</p>
              <h2>Flora y fauna públicas priorizadas para esta selección</h2>
            </div>
          </div>
          <div className="grid-two">
            {species.map((entry) => (
              <SpeciesCard key={entry.id} species={entry} />
            ))}
          </div>
        </div>

        <aside className="detail-panel">
          <p className="eyebrow">Citas</p>
          <h2>Trazabilidad pública para esta área</h2>
          <div className="citation-stack">
            {entityCitations.map((citation) => (
              <div className="citation-item" key={citation.id}>
                <strong>{citation.title}</strong>
                <p>{citation.text}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      {relatedAreas.length ? (
        <section className="detail-panel">
          <div className="home-section-head">
            <div>
              <p className="eyebrow">Continuar</p>
              <h2>Otras áreas para seguir leyendo el atlas</h2>
            </div>
          </div>
          <div className="grid-two">
            {relatedAreas.map((entry) => (
              <AreaCard area={entry} key={entry.id} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
