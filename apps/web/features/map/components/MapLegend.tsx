import { getMapIcon } from "@/features/map/assets/iconRegistry";
import type { MapLegendItem } from "@/features/map/assets/iconTypes";
import { MapIcon } from "@/features/map/components/MapIcon";
import { resolveLegendSwatchForStyleKey } from "@/features/map/styles/mapStyleResolvers";

type MapLegendProps = {
  items: MapLegendItem[];
  emptyLabel?: string;
  className?: string;
};

export function MapLegend({
  items,
  emptyLabel = "No hay capas visibles para mostrar en leyenda.",
  className
}: MapLegendProps) {
  if (!items.length) {
    return <div className={className ?? "atlas-map-legend"}>{emptyLabel}</div>;
  }

  return (
    <div className={className ?? "atlas-map-legend"}>
      {items.map((item) => {
        const metadata = getMapIcon(item.iconId);
        const label = item.label ?? metadata.label;
        const legendSwatch =
          resolveLegendSwatchForStyleKey(item.styleKey, item.styleContext ?? {}) ?? metadata.legendSwatch;

        return (
          <span className="legend-item" key={`${item.iconId}-${label}`}>
            {legendSwatch ? (
              <span
                aria-hidden="true"
                className={`legend-swatch legend-swatch-${legendSwatch.type} ${
                  legendSwatch.type === "fill" &&
                  legendSwatch.shape === "rounded-rect"
                    ? "legend-swatch-rect"
                    : ""
                }`}
                style={
                  legendSwatch.type === "fill"
                    ? {
                        background: legendSwatch.fill,
                        borderColor: legendSwatch.stroke ?? "transparent"
                      }
                    : {
                        background: "transparent",
                        borderColor: "transparent",
                        boxShadow: `inset 0 ${Math.max(legendSwatch.strokeWidth ?? 2, 2)}px 0 0 ${legendSwatch.stroke}`
                      }
                }
              />
            ) : (
              <MapIcon className="legend-icon" decorative iconId={item.iconId} size={16} />
            )}
            {label}
          </span>
        );
      })}
    </div>
  );
}
