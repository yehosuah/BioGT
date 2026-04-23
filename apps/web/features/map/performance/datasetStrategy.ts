import type { MapGeometryType } from "@/features/map/core/MapTypes";

export type MapDatasetSizeClass = "tiny" | "small" | "medium" | "large" | "huge";

export type MapDatasetStrategy = {
  sizeClass: MapDatasetSizeClass;
  shouldCluster: boolean;
  shouldUseViewportLoading: boolean;
  shouldUseVectorTiles: boolean;
  shouldLazyLoad: boolean;
  shouldWarn: boolean;
  maxDirectRenderFeatures: number;
};

export type DatasetStrategyOptions = {
  clusterPointsFrom?: number;
  maxDirectRenderFeatures?: number;
};

const DEFAULT_CLUSTER_POINTS_FROM = 1_001;
const DEFAULT_MAX_DIRECT_RENDER_FEATURES = 10_000;

const resolveSizeClass = (featureCount: number): MapDatasetSizeClass => {
  if (featureCount <= 100) {
    return "tiny";
  }

  if (featureCount <= 1_000) {
    return "small";
  }

  if (featureCount <= 10_000) {
    return "medium";
  }

  if (featureCount <= 100_000) {
    return "large";
  }

  return "huge";
};

export const getDatasetStrategy = (
  featureCount: number,
  geometryType: MapGeometryType,
  options: DatasetStrategyOptions = {}
): MapDatasetStrategy => {
  const sizeClass = resolveSizeClass(Math.max(0, Math.floor(featureCount)));
  const clusterThreshold = options.clusterPointsFrom ?? DEFAULT_CLUSTER_POINTS_FROM;
  const maxDirectRenderFeatures =
    options.maxDirectRenderFeatures ?? DEFAULT_MAX_DIRECT_RENDER_FEATURES;
  const shouldCluster =
    geometryType === "point" &&
    featureCount >= clusterThreshold &&
    (sizeClass === "medium" || sizeClass === "large" || sizeClass === "huge");

  return {
    sizeClass,
    shouldCluster,
    shouldUseViewportLoading: sizeClass === "large" || sizeClass === "huge",
    shouldUseVectorTiles: sizeClass === "huge",
    shouldLazyLoad: sizeClass !== "tiny",
    shouldWarn: sizeClass === "large" || sizeClass === "huge",
    maxDirectRenderFeatures
  };
};
