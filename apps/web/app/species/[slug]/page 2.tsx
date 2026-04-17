import { notFound } from "next/navigation";

import { AreaCard } from "@/components/area-card";
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
    <div className="detail-layout">
      <section className="detail-panel">
        <SpeciesCard species={species} />
        <h3>Presencia pública por territorio</h3>
        <div className="grid-two">
          {areas.map((area) => (
            <AreaCard area={area} key={area.id} />
          ))}
        </div>
      </section>

      <aside className="grid-two">
        <div className="detail-panel">
          <p className="eyebrow">Geoprivacidad</p>
          <h2>Distribución pública, no puntos exactos</h2>
          <p>
            La página resume presencia por territorio y celdas públicas. Las
            coordenadas sensibles nunca salen del plano interno.
          </p>
          {entityCitations.map((citation) => (
            <p key={citation.id}>
              <strong>{citation.title}.</strong> {citation.text}
            </p>
          ))}
        </div>

        <div className="detail-panel">
          <p className="eyebrow">Más de este grupo</p>
          <h2>Especies relacionadas</h2>
          <div className="grid-two">
            {similar.map((entry) => (
              <SpeciesCard key={entry.id} species={entry} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
