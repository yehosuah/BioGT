"use client";

import type { ReactNode } from "react";

import type { NormalizedFeatureReference } from "@/features/map/core/interactionTypes";

type MobileBottomSheetProps = {
  open: boolean;
  feature: NormalizedFeatureReference | null;
  onClose: () => void;
  children: ReactNode;
};

export function MobileBottomSheet({
  open,
  feature,
  onClose,
  children
}: MobileBottomSheetProps) {
  const title =
    String(feature?.properties?.label ?? feature?.properties?.name ?? "Detalle del mapa");

  return (
    <div
      aria-hidden={!open}
      className={`atlas-mobile-sheet ${open ? "is-open" : ""}`}
      data-testid="mobile-bottom-sheet"
    >
      <div className="atlas-mobile-sheet-backdrop" onClick={onClose} />
      <section aria-label={title} aria-modal="false" className="atlas-mobile-sheet-panel" role="dialog">
        <div className="atlas-mobile-sheet-handle" />
        <div className="atlas-mobile-sheet-head">
          <div>
            <p className="atlas-section-label">Detalle móvil</p>
            <strong>{title}</strong>
          </div>
          <button aria-label="Cerrar panel móvil" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>
        <div className="atlas-mobile-sheet-body">{children}</div>
      </section>
    </div>
  );
}
