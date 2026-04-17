import Link from "next/link";

import { SourceBadge } from "@/components/source-badge";
import type { MapSpeciesCard as MapSpeciesCardRecord } from "@/lib/types";

export function MapSpeciesCard({
  species,
  actionLabel,
  onAction,
  hrefLabel = "Abrir ficha"
}: {
  species: MapSpeciesCardRecord;
  actionLabel?: string;
  onAction?: () => void;
  hrefLabel?: string;
}) {
  return (
    <article className="map-species-card">
      <div className="map-species-visual" style={{ backgroundImage: species.visual.accent }}>
        {species.visual.kind === "photo" && species.visual.src ? (
          <img alt={species.visual.alt} src={species.visual.src} />
        ) : (
          <div className="map-species-fallback" aria-hidden="true">
            {species.visual.fallbackLabel}
          </div>
        )}
      </div>

      <div className="map-species-body">
        <div className="map-species-header">
          <span className="entity-card-eyebrow">{species.group}</span>
          <strong>{species.commonName}</strong>
          <em>{species.scientificName}</em>
        </div>

        <p>{species.summary}</p>

        <div className="map-quick-facts">
          {species.quickFacts.map((fact) => (
            <div className="map-quick-fact" key={`${species.speciesId}-${fact.label}`}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>

        <div className="badge-row">
          {species.sourceTiers.map((tier, index) => (
            <SourceBadge key={`${species.speciesId}-${tier}-${index}`} tier={tier} />
          ))}
        </div>

        <div className="map-species-footer">
          <span>{species.heroMetric}</span>
          {species.visual.attribution ? (
            <small>
              {species.visual.attribution}
              {species.visual.license ? ` · ${species.visual.license}` : ""}
            </small>
          ) : (
            <small>Fallback visual por grupo taxonómico.</small>
          )}
        </div>

        <Link className="entity-card-link" href={species.href}>
          {hrefLabel}
        </Link>
        {actionLabel && onAction ? (
          <button className="map-species-action" onClick={onAction} type="button">
            {actionLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}
