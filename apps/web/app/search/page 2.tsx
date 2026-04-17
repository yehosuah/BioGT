import { searchEntities } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = await searchEntities(q);

  return (
    <div className="search-layout">
      <section className="detail-panel">
        <p className="eyebrow">Búsqueda unificada</p>
        <h2>Especies, áreas y fuentes en una sola superficie</h2>
        <form action="/search" className="search-form">
          <input defaultValue={q} name="q" placeholder="Busca quetzal, Tikal o Biodiversidad.gt" />
          <button type="submit">Buscar</button>
        </form>

        {results.length === 0 ? (
          <div className="empty-state">No se encontraron resultados para esa consulta.</div>
        ) : (
          <div className="grid-two">
            {results.map((result) => (
              <article className="entity-card" key={`${result.type}-${result.id}`}>
                <p className="entity-card-eyebrow">{result.type}</p>
                <h3>{result.title}</h3>
                <p>{result.subtitle}</p>
                <a className="entity-card-link" href={result.href}>
                  Abrir resultado
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="detail-panel">
        <p className="eyebrow">Cómo usarlo</p>
        <h2>Un inicio simple para público general</h2>
        <p>
          El buscador reúne especies, áreas protegidas, departamentos y fuentes.
          Desde cualquier resultado se puede profundizar en distribución pública,
          contexto editorial y citas.
        </p>
      </aside>
    </div>
  );
}
