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
    <div className="detail-layout">
      <section className="detail-panel">
        <p className="eyebrow">{area.kind === "protected_area" ? "Área protegida" : "Región"}</p>
        <h2>{area.name}</h2>
        <p>{area.summary}</p>
        <div className="metric-row">
          <span>{area.metrics.speciesCount} especies visibles</span>
          <span>{area.metrics.endemicCount} endémicas</span>
          <span>{area.visibility}</span>
        </div>
        <h3>Especies destacadas</h3>
        <div className="grid-two">
          {species.map((entry) => (
            <SpeciesCard key={entry.id} species={entry} />
          ))}
        </div>
      </section>

      <aside className="grid-two">
        <div className="detail-panel">
          <p className="eyebrow">Citas</p>
          <h2>Trazabilidad pública</h2>
          {entityCitations.map((citation) => (
            <p key={citation.id}>
              <strong>{citation.title}.</strong> {citation.text}
            </p>
          ))}
        </div>

        <div className="detail-panel">
          <p className="eyebrow">Continuar</p>
          <h2>Otras áreas para explorar</h2>
          {relatedAreas.map((entry) => (
            <AreaCard area={entry} key={entry.id} />
          ))}
        </div>
      </aside>
    </div>
  );
}
