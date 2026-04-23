"use client";

import type { ReactNode } from "react";

import type { NormalizedFeatureReference } from "@/features/map/core/interactionTypes";

type FeatureDetailPanelProps = {
  feature: NormalizedFeatureReference | null;
  isActive: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function FeatureDetailPanel({
  feature,
  isActive,
  onClose,
  children
}: FeatureDetailPanelProps) {
  const title =
    String(feature?.properties?.label ?? feature?.properties?.name ?? "Selección del mapa");

  return (
    <aside className="atlas-panel atlas-feature-detail-panel" data-testid="feature-detail-panel">
      <div className="atlas-feature-detail-bar">
        <div>
          <p className="atlas-section-label">Detalle del mapa</p>
          <strong data-testid="feature-title">{title}</strong>
        </div>
        {isActive ? (
          <button aria-label="Cerrar detalle del mapa" onClick={onClose} type="button">
            Cerrar
          </button>
        ) : null}
      </div>
      {feature ? (
        children
      ) : (
        <div className="atlas-feature-detail-empty" data-testid="feature-detail-empty">
          <h2>Selecciona un elemento del mapa</h2>
          <p>
            Haz clic en una geometría, un marcador o un resultado de búsqueda para abrir detalle en
            panel o hoja móvil.
          </p>
        </div>
      )}
    </aside>
  );
}
