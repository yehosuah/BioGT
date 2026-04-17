import Link from "next/link";

import { SourceBadge } from "@/components/source-badge";
import type { AreaRecord } from "@/lib/types";

export function AreaCard({ area }: { area: AreaRecord }) {
  return (
    <article className="entity-card area-card">
      <div className="entity-card-header">
        <span className="entity-card-eyebrow">{area.kind === "protected_area" ? "Área protegida" : "Región"}</span>
        <h3>{area.name}</h3>
      </div>
      <p>{area.summary}</p>
      <div className="area-card-stats">
        <div className="area-card-stat">
          <span>Especies visibles</span>
          <strong>{area.metrics.speciesCount}</strong>
        </div>
        <div className="area-card-stat">
          <span>Endémicas</span>
          <strong>{area.metrics.endemicCount}</strong>
        </div>
        <div className="area-card-stat">
          <span>Lectura</span>
          <strong>{area.metrics.storyLabel}</strong>
        </div>
      </div>
      <div className="badge-row">
        {(area.sourceTiers ?? []).slice(0, 2).map((tier, index) => (
          <SourceBadge key={`${area.id}-${tier}-${index}`} tier={tier} />
        ))}
      </div>
      <Link className="entity-card-link" href={`/areas/${area.slug}`}>
        Abrir ficha
      </Link>
    </article>
  );
}
