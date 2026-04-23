import { resolveLayerState } from "@/features/map/registry/layerResolvers";
import type { MapLayerConfig } from "@/features/map/core/MapTypes";
import type { MapDatasetStrategy } from "@/features/map/performance/datasetStrategy";

export type MapLayerLoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "hidden"
  | "disabled"
  | "too_large"
  | "invalid";

export type MapLayerLoadState = {
  status: MapLayerLoadStatus;
  message: string;
  errors?: string[];
  featureCount?: number;
  strategy?: MapDatasetStrategy;
};

const TOO_LARGE_MESSAGE =
  "This dataset is too large to display all at once. Zoom in, apply filters, or use a tiled/viewport source.";

export const buildLayerLoadState = ({
  layer,
  status,
  featureCount,
  strategy,
  errors,
  viewMode
}: {
  layer: MapLayerConfig | null;
  status: MapLayerLoadStatus;
  featureCount?: number;
  strategy?: MapDatasetStrategy;
  errors?: string[];
  viewMode?: string;
}): MapLayerLoadState => {
  let resolvedMessage = "";

  switch (status) {
    case "disabled":
      resolvedMessage = "Layer available on demand.";
      break;
    case "too_large":
      resolvedMessage = TOO_LARGE_MESSAGE;
      break;
    case "ready":
      resolvedMessage = layer?.id ?? "ready";
      break;
    case "idle":
      resolvedMessage = "";
      break;
    case "hidden":
      resolvedMessage = resolveLayerState(layer, "hidden", { viewMode })?.message ?? "";
      break;
    default:
      resolvedMessage = resolveLayerState(layer, status, { viewMode })?.message ?? "";
      break;
  }

  return {
    status,
    message: resolvedMessage,
    errors,
    featureCount,
    strategy
  };
};
