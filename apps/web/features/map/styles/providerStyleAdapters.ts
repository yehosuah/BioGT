import type { MapLayerResolvedStyle } from "@/features/map/core/MapTypes";
import type { ResolvedMapVisualStyle } from "@/features/map/styles/mapStyleTypes";
import { toMapColor, withAlpha } from "@/features/map/styles/mapTokens";

export const toMapLibreDeckGeoJsonStyle = (
  style: ResolvedMapVisualStyle
): MapLayerResolvedStyle => {
  const fillOpacity = style.fillOpacity ?? style.opacity ?? 1;
  const lineOpacity = style.opacity ?? 1;
  const pointOpacity = style.opacity ?? 1;

  return {
    fillColor: style.fillColor ? toMapColor(style.fillColor as `#${string}`, fillOpacity) : undefined,
    lineColor: style.strokeColor
      ? toMapColor(style.strokeColor as `#${string}`, lineOpacity)
      : undefined,
    lineWidth: style.strokeWidth,
    pointRadius: style.radius,
    pointColor: style.fillColor ? toMapColor(style.fillColor as `#${string}`, pointOpacity) : undefined,
    opacity: style.opacity
  };
};

export const toLegendSwatchStyle = (
  style: ResolvedMapVisualStyle,
  geometryType: string
) => {
  if (geometryType === "line") {
    return style.strokeColor
      ? {
          type: "line" as const,
          stroke: withAlpha(style.strokeColor as `#${string}`, style.opacity ?? 1),
          strokeWidth: Math.max(style.strokeWidth ?? 2, 2)
        }
      : null;
  }

  if (!style.fillColor && !style.strokeColor) {
    return null;
  }

  return {
    type: "fill" as const,
    fill: style.fillColor
      ? withAlpha(style.fillColor as `#${string}`, style.fillOpacity ?? style.opacity ?? 1)
      : "transparent",
    stroke: style.strokeColor
      ? withAlpha(style.strokeColor as `#${string}`, style.opacity ?? 1)
      : undefined,
    shape: geometryType === "polygon" ? ("rounded-rect" as const) : ("circle" as const)
  };
};
