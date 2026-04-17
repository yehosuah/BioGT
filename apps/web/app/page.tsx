import Link from "next/link";

import { AreaCard } from "@/components/area-card";
import { PretextTitle } from "@/components/pretext-title";
import { SourceBadge } from "@/components/source-badge";
import { SpeciesCard } from "@/components/species-card";
import { getNationalSummary } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const summary = await getNationalSummary();

  return (
    <div className="home-shell">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">BioMap Guatemala</p>
          <PretextTitle
            as="h1"
            className="home-headline"
            font='650 64px "Fraunces"'
            lineHeight={72}
            maxWidth={700}
            text="Biodiversidad pública organizada para explorar territorios, especies y procedencia con claridad."
          />
          <p className="home-lead">
            El atlas prioriza lectura territorial real: departamentos, áreas protegidas, celdas
            públicas y especies visibles en una interfaz pensada para público general, educación y
            conservación.
          </p>

          <div className="home-hero-actions">
            <Link className="entity-card-link" href="/map">
              Abrir explorador
            </Link>
            <Link className="pill-link" href="/search">
              Buscar especies y áreas
            </Link>
          </div>

          <div className="home-metric-strip">
            <div>
              <strong>{summary.metrics.speciesCount}</strong>
              <span>especies visibles</span>
            </div>
            <div>
              <strong>{summary.metrics.protectedAreas}</strong>
              <span>áreas protegidas</span>
            </div>
            <div>
              <strong>{summary.metrics.featuredDepartments}</strong>
              <span>departamentos</span>
            </div>
            <div>
              <strong>{summary.metrics.sources}</strong>
              <span>fuentes activas</span>
            </div>
          </div>
        </div>

        <div className="home-hero-panel">
          <p className="eyebrow">Cómo funciona</p>
          <div className="home-step-list">
            <article>
              <strong>1. Entra por territorio</strong>
              <span>La vista principal organiza departamentos, áreas protegidas y celdas públicas.</span>
            </article>
            <article>
              <strong>2. Detecta especies visibles</strong>
              <span>Los objetos del mapa te llevan de la región a especies concretas sin saturar la lectura.</span>
            </article>
            <article>
              <strong>3. Verifica procedencia</strong>
              <span>Cada ficha deja visible el tipo de fuente, licencia y contexto editorial público.</span>
            </article>
          </div>
          <div className="badge-row">
            <SourceBadge tier="official" />
            <SourceBadge tier="institutional" />
            <SourceBadge tier="community" />
          </div>
        </div>
      </section>

      <section className="home-story-grid">
        {summary.storyModules.map((story) => (
          <article className="story-card" key={story.id}>
            <p className="entity-card-eyebrow">{story.eyebrow}</p>
            <h3>{story.title}</h3>
            <p>{story.body}</p>
            {story.href ? (
              <Link className="pill-link" href={story.href}>
                Abrir recorrido
              </Link>
            ) : null}
          </article>
        ))}
      </section>

      <section className="home-showcase">
        <div className="home-showcase-section">
          <div className="home-section-head">
            <div>
              <p className="eyebrow">Áreas priorizadas</p>
              <h2>Territorios listos para exploración pública</h2>
            </div>
            <Link className="pill-link" href="/map">
              Ver mapa completo
            </Link>
          </div>
          <div className="grid-two">
            {summary.featuredAreas.map((area) => (
              <AreaCard area={area} key={area.id} />
            ))}
          </div>
        </div>

        <div className="home-showcase-section">
          <div className="home-section-head">
            <div>
              <p className="eyebrow">Especies destacadas</p>
              <h2>Fichas con distribución, quick facts y trazabilidad</h2>
            </div>
            <Link className="pill-link" href="/search">
              Explorar fichas
            </Link>
          </div>
          <div className="grid-two">
            {summary.featuredSpecies.map((species) => (
              <SpeciesCard key={species.id} species={species} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
