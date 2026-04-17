import Link from "next/link";

import { SourceBadge } from "@/components/source-badge";
import type { SpeciesRecord } from "@/lib/types";

const formatGroupLabel = (value: string) =>
  value
    .replaceAll("-", " ")
    .replace(/\b\p{L}/gu, (match) => match.toUpperCase());

export function SpeciesCard({ species }: { species: SpeciesRecord }) {
  const visual =
    species.visual ?? {
      kind: "fallback" as const,
      src: null,
      alt: `Representación pública de ${species.commonName}`,
      attribution: null,
      license: null,
      sourceName: null,
      accent: "linear-gradient(135deg, #28594d 0%, #8cab7b 100%)",
      fallbackLabel: species.commonName.slice(0, 1).toUpperCase()
    };

  return (
    <article className="entity-card species-card">
      <div
        className="species-card-visual"
        style={visual.kind === "photo" && visual.src ? undefined : { background: visual.accent }}
      >
        {visual.kind === "photo" && visual.src ? <img alt={visual.alt} src={visual.src} /> : null}
        {visual.kind === "fallback" ? (
          <div className="species-card-fallback" aria-hidden="true">
            {visual.fallbackLabel}
          </div>
        ) : null}
        <div className="species-card-chiprow">
          <span className="entity-card-eyebrow">{formatGroupLabel(species.group)}</span>
          {species.status ? <span className="species-card-chip">{species.status}</span> : null}
        </div>
      </div>

      <div className="species-card-body">
        <div className="entity-card-header">
          <h3>{species.commonName}</h3>
          <p className="latin-name">{species.scientificName}</p>
        </div>

        <p>{species.summary}</p>

        <div className="metric-row">
          {species.endemism ? <span>{species.endemism}</span> : null}
          {species.heroMetric ? <span>{species.heroMetric}</span> : null}
        </div>

        <div className="badge-row">
          {(species.sourceTiers ?? []).map((tier, index) => (
            <SourceBadge key={`${species.id}-${tier}-${index}`} tier={tier} />
          ))}
        </div>

        {visual.attribution ? (
          <p className="species-card-credit">
            {visual.attribution}
            {visual.license ? ` · ${visual.license}` : ""}
          </p>
        ) : null}

        <Link className="entity-card-link" href={`/species/${species.slug}`}>
          Ver distribución pública
        </Link>
      </div>
    </article>
  );
}
