"use client";

import type { CSSProperties, ReactNode } from "react";

import type { NormalizedFeatureReference } from "@/features/map/core/interactionTypes";

type FeaturePopupProps = {
  feature: NormalizedFeatureReference;
  title: string;
  meta: string;
  supportingLine?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  footer?: ReactNode;
};

export function FeaturePopup({
  feature,
  title,
  meta,
  supportingLine,
  actionLabel = "Abrir detalle",
  onAction,
  footer
}: FeaturePopupProps) {
  if (!feature.screenPoint) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="atlas-feature-popup"
      style={
        {
          "--popup-x": `${feature.screenPoint.x}px`,
          "--popup-y": `${feature.screenPoint.y}px`
        } as CSSProperties
      }
    >
      <span className="atlas-feature-popup-meta">{meta}</span>
      <strong>{title}</strong>
      {supportingLine ? <p>{supportingLine}</p> : null}
      <div className="atlas-feature-popup-actions">
        {onAction ? (
          <button onClick={onAction} type="button">
            {actionLabel}
          </button>
        ) : null}
        {footer}
      </div>
    </div>
  );
}
