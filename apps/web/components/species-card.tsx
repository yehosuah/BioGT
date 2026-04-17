import Link from "next/link";

import { SourceBadge } from "@/components/source-badge";
import type { SpeciesRecord } from "@/lib/types";

export function SpeciesCard({ species }: { species: SpeciesRecord }) {
  return (
    <article className="entity-card entity-card-dark">
      <div className="entity-card-header">
        <span className="entity-card-eyebrow">{species.group}</span>
        <h3>{species.commonName}</h3>
      </div>
      <p className="latin-name">{species.scientificName}</p>
      <p>{species.summary}</p>
      <div className="metric-row">
        <span>{species.status}</span>
        <span>{species.endemism}</span>
        <span>{species.heroMetric}</span>
      </div>
      <div className="badge-row">
        {(species.sourceTiers ?? []).map((tier, index) => (
          <SourceBadge key={`${species.id}-${tier}-${index}`} tier={tier} />
        ))}
      </div>
      <Link className="entity-card-link" href={`/species/${species.slug}`}>
        Ver distribución pública
      </Link>
    </article>
  );
}
