import { getMapIcon } from "@/features/map/assets/iconRegistry";
import type {
  LayerStateConfig,
  MapDynamicValue,
  MapFeature,
  MapLayerConfig,
  MapLayerResolvedStyle,
  MapLayerResolverContext,
  MapLayerStates
} from "@/features/map/core/MapTypes";
import { toMapLibreDeckGeoJsonStyle } from "@/features/map/styles/providerStyleAdapters";
import { resolveFeatureLabel, resolveMapStyleForLayer } from "@/features/map/styles/mapStyleResolvers";

const readFeatureProperty = (feature: MapFeature | undefined, key: string) => feature?.properties?.[key];

export const resolveDynamicValue = <T>(
  value: MapDynamicValue<T> | undefined,
  context: MapLayerResolverContext,
  fallback: T
): T => {
  if (typeof value === "function") {
    return (value as (nextContext: MapLayerResolverContext) => T)(context);
  }

  return value ?? fallback;
};

export const resolveLayerStyle = (
  layerConfig: MapLayerConfig | null | undefined,
  feature?: MapFeature,
  context: Omit<MapLayerResolverContext, "feature" | "layerId"> = {}
): MapLayerResolvedStyle => {
  const nextContext: MapLayerResolverContext = {
    ...context,
    feature,
    layerId: layerConfig?.id
  };

  const sharedStyle = resolveMapStyleForLayer(layerConfig, feature, context);
  if (Object.keys(sharedStyle).length > 0) {
    return toMapLibreDeckGeoJsonStyle(sharedStyle);
  }

  if (!layerConfig?.style) {
    return {};
  }

  return {
    fillColor:
      layerConfig.style.fillColor !== undefined
        ? resolveDynamicValue(layerConfig.style.fillColor, nextContext, undefined)
        : undefined,
    lineColor:
      layerConfig.style.lineColor !== undefined
        ? resolveDynamicValue(layerConfig.style.lineColor, nextContext, undefined)
        : undefined,
    lineWidth:
      layerConfig.style.lineWidth !== undefined
        ? resolveDynamicValue(layerConfig.style.lineWidth, nextContext, undefined)
        : undefined,
    pointRadius:
      layerConfig.style.pointRadius !== undefined
        ? resolveDynamicValue(layerConfig.style.pointRadius, nextContext, undefined)
        : undefined,
    pointColor:
      layerConfig.style.pointColor !== undefined
        ? resolveDynamicValue(layerConfig.style.pointColor, nextContext, undefined)
        : undefined,
    opacity:
      layerConfig.style.opacity !== undefined
        ? resolveDynamicValue(layerConfig.style.opacity, nextContext, undefined)
        : undefined,
    textColor:
      layerConfig.style.textColor !== undefined
        ? resolveDynamicValue(layerConfig.style.textColor, nextContext, undefined)
        : undefined,
    textHaloColor:
      layerConfig.style.textHaloColor !== undefined
        ? resolveDynamicValue(layerConfig.style.textHaloColor, nextContext, undefined)
        : undefined,
    textSize:
      layerConfig.style.textSize !== undefined
        ? resolveDynamicValue(layerConfig.style.textSize, nextContext, undefined)
        : undefined
  };
};

export const resolveLayerIcon = (
  layerConfig: MapLayerConfig | null | undefined,
  feature?: MapFeature,
  context: Omit<MapLayerResolverContext, "feature" | "layerId"> = {}
) => {
  if (!layerConfig?.icons) {
    return null;
  }

  const nextContext: MapLayerResolverContext = {
    ...context,
    feature,
    layerId: layerConfig.id
  };

  const iconId =
    (layerConfig.icons.iconId
      ? resolveDynamicValue(layerConfig.icons.iconId, nextContext, null)
      : null) ??
    (layerConfig.icons.iconByProperty
      ? String(readFeatureProperty(feature, layerConfig.icons.iconByProperty) ?? "")
      : null) ??
    layerConfig.icons.fallbackIcon ??
    null;

  return iconId ? getMapIcon(iconId) : null;
};

export const resolveLayerLabel = (
  layerConfig: MapLayerConfig | null | undefined,
  feature?: MapFeature,
  context: Omit<MapLayerResolverContext, "feature" | "layerId"> = {}
) => {
  if (!layerConfig) {
    return null;
  }

  const nextContext: MapLayerResolverContext = {
    ...context,
    feature,
    layerId: layerConfig.id
  };

  const sharedLabel = resolveMapStyleForLayer(layerConfig, feature, context).label;
  if (typeof sharedLabel === "string" && sharedLabel.length > 0) {
    return sharedLabel;
  }

  if (layerConfig.labels) {
    const minZoom = layerConfig.labels.minZoom;
    if (typeof minZoom === "number" && typeof context.zoom === "number" && context.zoom < minZoom) {
      return null;
    }

    const maxZoom = layerConfig.labels.maxZoom;
    if (typeof maxZoom === "number" && typeof context.zoom === "number" && context.zoom > maxZoom) {
      return null;
    }

    if (layerConfig.labels.text !== undefined) {
      return resolveDynamicValue(layerConfig.labels.text, nextContext, null);
    }

    if (layerConfig.labels.textByProperty) {
      const propertyValue = readFeatureProperty(feature, layerConfig.labels.textByProperty);
      if (propertyValue !== undefined && propertyValue !== null && String(propertyValue).length > 0) {
        return String(propertyValue);
      }
    }

    if (layerConfig.labels.fallbackText) {
      return layerConfig.labels.fallbackText;
    }
  }

  return resolveDynamicValue(layerConfig.label, nextContext, layerConfig.id) ??
    resolveFeatureLabel(feature, undefined, layerConfig.id);
};

export const resolveLayerDescription = (
  layerConfig: MapLayerConfig | null | undefined,
  context: Omit<MapLayerResolverContext, "layerId"> = {}
) => {
  if (!layerConfig?.description) {
    return null;
  }

  return resolveDynamicValue(
    layerConfig.description,
    {
      ...context,
      layerId: layerConfig.id
    },
    null
  );
};

export const resolveLayerTooltip = (
  layerConfig: MapLayerConfig | null | undefined,
  feature?: MapFeature,
  context: Omit<MapLayerResolverContext, "feature" | "layerId"> = {}
) => {
  if (!layerConfig?.interactions?.tooltip) {
    return null;
  }

  return resolveDynamicValue(
    layerConfig.interactions.tooltip,
    {
      ...context,
      feature,
      layerId: layerConfig.id
    },
    null
  );
};

export const resolveLayerState = (
  layerConfig: MapLayerConfig | null | undefined,
  state: keyof MapLayerStates,
  context: Omit<MapLayerResolverContext, "layerId"> = {}
) => {
  if (!layerConfig?.states[state]) {
    return null;
  }

  const stateConfig = layerConfig.states[state] as LayerStateConfig;
  return {
    ...stateConfig,
    message: resolveDynamicValue(
      stateConfig.message,
      {
        ...context,
        layerId: layerConfig.id
      },
      ""
    )
  };
};
