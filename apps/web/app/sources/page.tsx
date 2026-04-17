import { SourceBadge } from "@/components/source-badge";
import { getEntityCitations, listSources } from "@/lib/repository";
import type { SourceTier } from "@/lib/types";

export const dynamic = "force-dynamic";

const tierOrder: SourceTier[] = ["official", "institutional", "community"];

const tierTitles: Record<SourceTier, string> = {
  official: "Capas oficiales",
  institutional: "Capas institucionales",
  community: "Capas comunitarias"
};

export default async function SourcesPage() {
  const sources = await listSources();
  const citationsBySource = await Promise.all(
    sources.map(async (source) => [source.id, await getEntityCitations(source.id)] as const)
  );
  const citationMap = new Map(citationsBySource);

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="detail-panel">
          <p className="eyebrow">Modelo de confianza</p>
          <h2>Las fuentes tienen rol, licencia y narrativa explícita</h2>
          <p>
            La interfaz pública nunca mezcla procedencias sin avisar. Cada fuente se presenta con
            su propósito, frescura, licencia y notas de citación.
          </p>
        </div>

        <aside className="detail-panel">
          <p className="eyebrow">Uso en producto</p>
          <h2>La procedencia se lee tan fácil como la especie</h2>
          <p>
            Lo oficial respalda territorios, lo institucional soporta presencia canónica y lo
            comunitario se muestra como enriquecimiento claramente rotulado.
          </p>
          <div className="badge-row">
            <SourceBadge tier="official" />
            <SourceBadge tier="institutional" />
            <SourceBadge tier="community" />
          </div>
        </aside>
      </section>

      <div className="catalog-stack">
        {tierOrder.map((tier) => {
          const items = sources.filter((source) => source.tier === tier);
          if (items.length === 0) {
            return null;
          }

          return (
            <section className="detail-panel" key={tier}>
              <div className="home-section-head">
                <div>
                  <p className="eyebrow">{tierTitles[tier]}</p>
                  <h2>{items.length} fuente{items.length === 1 ? "" : "s"} en esta capa</h2>
                </div>
              </div>
              <div className="grid-two">
                {items.map((source) => (
                  <article className="source-card" key={source.id}>
                    <div className="source-card-top">
                      <SourceBadge tier={source.tier} />
                      <h2>{source.name}</h2>
                    </div>
                    <p>{source.description}</p>
                    <div className="source-meta-list">
                      <p>
                        <strong>Frescura</strong>
                        <span>{source.freshness}</span>
                      </p>
                      <p>
                        <strong>Licencia</strong>
                        <span>{source.license}</span>
                      </p>
                      <p>
                        <strong>Citación base</strong>
                        <span>{source.citation}</span>
                      </p>
                    </div>
                    {(citationMap.get(source.id) ?? []).length ? (
                      <div className="citation-stack">
                        {(citationMap.get(source.id) ?? []).map((citation) => (
                          <div className="citation-item" key={citation.id}>
                            <strong>{citation.title}</strong>
                            <p>{citation.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <a className="pill-link" href={source.homepage} rel="noreferrer" target="_blank">
                      Abrir fuente
                    </a>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
