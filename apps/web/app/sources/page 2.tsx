import { SourceBadge } from "@/components/source-badge";
import { getEntityCitations, listSources } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const sources = await listSources();
  const citationsBySource = await Promise.all(
    sources.map(async (source) => [source.id, await getEntityCitations(source.id)] as const)
  );
  const citationMap = new Map(citationsBySource);

  return (
    <div className="sources-layout">
      <section className="detail-panel">
        <p className="eyebrow">Modelo de confianza</p>
        <h2>Las fuentes tienen contexto, licencia y rol explícito</h2>
        <p>
          El producto separa capas oficiales, institucionales y comunitarias. La
          narrativa pública nunca oculta el origen de los datos que ves.
        </p>
      </section>

      <aside className="grid-two">
        {sources.map((source) => (
          <article className="source-card" key={source.id}>
            <div className="badge-row">
              <SourceBadge tier={source.tier} />
            </div>
            <h2>{source.name}</h2>
            <p>{source.description}</p>
            <p>
              <strong>Frescura:</strong> {source.freshness}
            </p>
            <p>
              <strong>Licencia:</strong> {source.license}
            </p>
            <p>
              <strong>Cita:</strong> {source.citation}
            </p>
            <a className="pill-link" href={source.homepage} rel="noreferrer" target="_blank">
              Abrir fuente
            </a>
            {(citationMap.get(source.id) ?? []).map((citation) => (
              <p key={citation.id}>
                <strong>{citation.title}.</strong> {citation.text}
              </p>
            ))}
          </article>
        ))}
      </aside>
    </div>
  );
}
