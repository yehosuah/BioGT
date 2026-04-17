import Link from "next/link";

import { AreaCard } from "@/components/area-card";
import { PretextHero } from "@/components/pretext-hero";
import { SourceBadge } from "@/components/source-badge";
import { SpeciesCard } from "@/components/species-card";
import { getNationalSummary } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const summary = await getNationalSummary();

  return (
    <div className="grid-two" style={{ gap: "28px" }}>
      <PretextHero
        body={summary.subtitle}
        kicker="Atlas público / mapa primero"
        title="Ver biodiversidad visible por territorio"
      />

      <section className="detail-panel">
        <p className="eyebrow">Ruta principal</p>
        <h2>Entrar al mapa y bajar a especies reales</h2>
        <p>
          El producto ahora se presenta como un explorador territorial: primero el
          mapa, luego la selección regional, y desde allí fichas de flora y fauna
          con visuales, quick facts y procedencia.
        </p>
        <Link className="pill-link" href="/map">
          Abrir explorador
        </Link>
      </section>

      <section className="grid-two">
        {summary.featuredAreas.map((area) => (
          <AreaCard area={area} key={area.id} />
        ))}
      </section>

      <section className="detail-panel">
        <p className="eyebrow">Especies visibles</p>
        <h2>Tarjetas preparadas para exploración regional</h2>
        <p>
          La experiencia pública prioriza distribución visible, contexto territorial
          y trazabilidad institucional antes que relatos editoriales largos.
        </p>
      </section>

      <section className="grid-two">
        {summary.featuredSpecies.map((entry) => (
          <SpeciesCard key={entry.id} species={entry} />
        ))}
      </section>

      <section className="detail-panel">
        <p className="eyebrow">Fuentes y soporte</p>
        <h2>La capa narrativa queda debajo del explorador</h2>
        <p>
          Las historias siguen presentes, pero como apoyo. La cobertura canónica del
          mapa parte de fuentes oficiales e institucionales y deja la capa
          comunitaria claramente rotulada.
        </p>
        <div className="badge-row">
          {summary.sources.map((source) => (
            <SourceBadge key={source.id} tier={source.tier} />
          ))}
        </div>
      </section>

      {summary.storyModules.map((module) => (
        <article className="story-card" key={module.id}>
          <p className="eyebrow">{module.eyebrow}</p>
          <h2>{module.title}</h2>
          <p>{module.body}</p>
          {module.href ? (
            <Link className="pill-link" href={module.href}>
              Abrir módulo
            </Link>
          ) : null}
        </article>
      ))}
    </div>
  );
}
