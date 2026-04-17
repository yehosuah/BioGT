import Link from "next/link";

import { searchEntities } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = await searchEntities(q);
  const groupedResults = {
    species: results.filter((result) => result.type === "species"),
    area: results.filter((result) => result.type === "area"),
    source: results.filter((result) => result.type === "source")
  };

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="detail-panel">
          <p className="eyebrow">Búsqueda unificada</p>
          <h2>Especies, áreas y fuentes en una sola superficie</h2>
          <p>
            La búsqueda pública sirve como punto de entrada rápido cuando ya conoces un nombre,
            una región o una institución.
          </p>
          <form action="/search" className="search-form">
            <input defaultValue={q} name="q" placeholder="Busca quetzal, Tikal o Biodiversidad.gt" />
            <button type="submit">Buscar</button>
          </form>
        </div>

        <aside className="detail-panel">
          <p className="eyebrow">Prioridad del flujo</p>
          <h2>Empieza por territorio, usa búsqueda para atajos</h2>
          <p>
            El mapa sigue siendo la entrada principal. La búsqueda acelera accesos a fichas,
            regiones y fuentes cuando el usuario ya sabe qué quiere abrir.
          </p>
          <div className="metric-row">
            <span>{groupedResults.species.length} especies</span>
            <span>{groupedResults.area.length} áreas</span>
            <span>{groupedResults.source.length} fuentes</span>
          </div>
        </aside>
      </section>

      {results.length === 0 ? (
        <div className="detail-panel empty-state">
          No se encontraron resultados para esa consulta. Intenta con nombre común, nombre científico o región.
        </div>
      ) : (
        <section className="catalog-stack">
          {(["species", "area", "source"] as const).map((group) =>
            groupedResults[group].length ? (
              <section className="detail-panel" key={group}>
                <div className="home-section-head">
                  <div>
                    <p className="eyebrow">
                      {group === "species" ? "Especies" : group === "area" ? "Áreas" : "Fuentes"}
                    </p>
                    <h2>
                      {group === "species"
                        ? "Resultados taxonómicos"
                        : group === "area"
                          ? "Resultados territoriales"
                          : "Resultados institucionales"}
                    </h2>
                  </div>
                </div>
                <div className="grid-two">
                  {groupedResults[group].map((result) => (
                    <article className="entity-card" key={`${result.type}-${result.id}`}>
                      <p className="entity-card-eyebrow">{result.type}</p>
                      <h3>{result.title}</h3>
                      <p>{result.subtitle}</p>
                      <Link className="entity-card-link" href={result.href}>
                        Abrir resultado
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            ) : null
          )}
        </section>
      )}
    </div>
  );
}
