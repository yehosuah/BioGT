import Link from "next/link";
import { notFound } from "next/navigation";

import { AreaCard } from "@/components/area-card";
import { SourceBadge } from "@/components/source-badge";
import { SpeciesCard } from "@/components/species-card";
import { getEntityCitations, getSpecies, getSpeciesAreas, listSpecies } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function SpeciesPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const species = await getSpecies(slug);

  if (!species) {
    notFound();
  }

  const [areas, entityCitations, allSpecies] = await Promise.all([
    getSpeciesAreas(species.id),
    getEntityCitations(species.id),
    listSpecies()
  ]);
  const similar = allSpecies
    .filter((entry) => entry.group === species.group && entry.id !== species.id)
    .slice(0, 2);

  return (
    <div className="page-stack">
      <section className="detail-layout">
        <div className="detail-panel">
          <p className="eyebrow">Ficha de especie</p>
          <h2>{species.commonName}</h2>
          <p className="latin-name">{species.scientificName}</p>
          <p>{species.summary}</p>
          <div className="metric-row">
            <span>{species.group}</span>
            <span>{species.status || "Sin estado"}</span>
            <span>{species.endemism || "Sin endemismo"}</span>
            <span>{species.heroMetric}</span>
          </div>
          <div className="badge-row">
            {(species.sourceTiers ?? []).map((tier, index) => (
              <SourceBadge key={`${species.id}-${tier}-${index}`} tier={tier} />
            ))}
          </div>
          <div className="detail-actions">
            <Link className="entity-card-link" href={`/map?viewMode=species&taxonSlug=${species.slug}`}>
              Ver en el mapa
            </Link>
          </div>
        </div>

        <aside className="detail-panel">
          <p className="eyebrow">Lectura pública</p>
          <h2>Distribución visible sin exponer puntos sensibles</h2>
          <p>
            La presencia se resume por territorio y celdas públicas generalizadas. La interfaz nunca
            publica coordenadas exactas de registros sensibles.
          </p>
        </aside>
      </section>

      <section className="detail-layout">
        <div className="detail-panel">
          <div className="home-section-head">
            <div>
              <p className="eyebrow">Presencia territorial</p>
              <h2>Áreas donde la especie aparece en la capa pública</h2>
            </div>
          </div>
          <div className="grid-two">
            {areas.map((area) => (
              <AreaCard area={area} key={area.id} />
            ))}
          </div>
        </div>

        <aside className="detail-panel">
          <p className="eyebrow">Citas y notas</p>
          <h2>Soporte editorial y procedencia</h2>
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

      {similar.length ? (
        <section className="detail-panel">
          <div className="home-section-head">
            <div>
              <p className="eyebrow">Continuar explorando</p>
              <h2>Otras especies del mismo grupo</h2>
            </div>
          </div>
          <div className="grid-two">
            {similar.map((entry) => (
              <SpeciesCard key={entry.id} species={entry} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
