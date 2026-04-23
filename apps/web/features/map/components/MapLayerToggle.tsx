import type { MapLayerConfig } from "@/features/map/core/MapTypes";
import { resolveLayerDescription, resolveLayerLabel } from "@/features/map/registry/layerResolvers";
import type { LayerVisibilityState } from "@/features/map/registry/layerRegistry";

type LayerRuntimeStatus = {
  status: string;
  message: string;
  errors?: string[];
};

type MapLayerToggleProps = {
  layers: MapLayerConfig[];
  layerVisibility: LayerVisibilityState;
  layerStatuses: Record<string, LayerRuntimeStatus>;
  viewMode?: string;
  onToggleLayer: (layerId: string, value: boolean) => void;
};

export function MapLayerToggle({
  layers,
  layerVisibility,
  layerStatuses,
  viewMode,
  onToggleLayer
}: MapLayerToggleProps) {
  return (
    <div className="atlas-layer-toggle-list">
      {layers.map((layer) => {
        const label = resolveLayerLabel(layer, undefined, { viewMode }) ?? layer.id;
        const description = resolveLayerDescription(layer, { viewMode });
        const runtime = layerStatuses[layer.id];

        return (
          <div className="atlas-layer-toggle-item" key={layer.id}>
            <label className="atlas-toggle-row">
              <input
                checked={layerVisibility[layer.id] ?? layer.visibleByDefault}
                data-testid={`layer-toggle-${layer.id}`}
                onChange={(event) => onToggleLayer(layer.id, event.target.checked)}
                type="checkbox"
              />
              <span>{label}</span>
            </label>

            {runtime?.message ? (
              <p className={`atlas-layer-status atlas-layer-status-${runtime.status}`}>
                {runtime.message}
              </p>
            ) : description ? (
              <p className="atlas-layer-status">{description}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
