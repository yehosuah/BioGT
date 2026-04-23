import type { MapFeature, MapLayerConfig, MapLayerResolverContext } from "@/features/map/core/MapTypes";
import { mapStyleRegistry, type MapStyleKey } from "@/features/map/styles/mapStyleRegistry";
import { toLegendSwatchStyle } from "@/features/map/styles/providerStyleAdapters";
import { mapTokens } from "@/features/map/styles/mapTokens";
import type {
  MapDataDrivenStyle,
  MapFeatureState,
  MapLayerStyleRule,
  MapStyleResolverContext,
  MapStyleValue,
  MapVisualStyle,
  ResolvedMapVisualStyle
} from "@/features/map/styles/mapStyleTypes";

const FALLBACK_PRIORITY_RADIUS = {
  low: mapTokens.sizes.marker.sm,
  medium: mapTokens.sizes.marker.md,
  high: mapTokens.sizes.marker.lg,
  critical: mapTokens.sizes.marker.xl
} as const;

const categoryColorMap: Record<string, string> = {
  restaurant: mapTokens.colors.category.restaurant,
  food: mapTokens.colors.category.restaurant,
  dining: mapTokens.colors.category.restaurant,
  service: mapTokens.colors.category.service,
  poi: mapTokens.colors.category.service,
  flora: mapTokens.colors.category.flora,
  fauna: mapTokens.colors.category.fauna
};

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "-") : undefined;

const readFeatureProperty = (feature: MapFeature | undefined, key: string) => feature?.properties?.[key];

const resolveStyleValue = <T>(
  value: MapStyleValue<T> | undefined,
  context: MapStyleResolverContext
): T | undefined => {
  if (typeof value === "function") {
    return (value as (nextContext: MapStyleResolverContext) => T | undefined)(context);
  }

  return value;
};

const mergeStyle = (
  base: Partial<MapVisualStyle>,
  override: Partial<MapVisualStyle> | undefined
): Partial<MapVisualStyle> => ({
  ...base,
  ...(override ?? {})
});

const resolveRangeRule = (
  rule: Extract<MapDataDrivenStyle, { kind: "byRange" }>,
  feature: MapFeature | undefined
) => {
  const value = Number(readFeatureProperty(feature, rule.property));
  if (Number.isNaN(value)) {
    return rule.fallback;
  }

  return (
    rule.ranges.find((entry) => {
      if (typeof entry.min === "number" && value < entry.min) {
        return false;
      }

      if (typeof entry.max === "number" && value > entry.max) {
        return false;
      }

      return true;
    })?.style ?? rule.fallback
  );
};

const resolvePropertyRule = (
  rule: Extract<MapDataDrivenStyle, { kind: "byProperty" }>,
  feature: MapFeature | undefined
) => {
  const normalized = normalizeText(readFeatureProperty(feature, rule.property ?? "category"));
  if (!normalized) {
    return rule.fallback;
  }

  return rule.mapping[normalized] ?? rule.fallback;
};

export const resolveStatusColor = (status: unknown) => {
  const normalized = normalizeText(status);

  switch (normalized) {
    case "active":
    case "success":
      return mapTokens.colors.status.active;
    case "inactive":
    case "disabled":
      return mapTokens.colors.status.inactive;
    case "pending":
      return mapTokens.colors.status.pending;
    case "warning":
      return mapTokens.colors.status.warning;
    case "danger":
    case "critical":
    case "error":
      return mapTokens.colors.status.danger;
    default:
      return mapTokens.colors.status.unknown;
  }
};

export const resolveCategoryColor = (category: unknown) => {
  const normalized = normalizeText(category);
  if (!normalized) {
    return mapTokens.colors.category.neutral;
  }

  return categoryColorMap[normalized] ?? mapTokens.colors.category.neutral;
};

export const resolvePrioritySize = (priority: unknown) => {
  const numeric = Number(priority);
  if (!Number.isNaN(numeric)) {
    if (numeric >= 4) {
      return FALLBACK_PRIORITY_RADIUS.critical;
    }
    if (numeric >= 3) {
      return FALLBACK_PRIORITY_RADIUS.high;
    }
    if (numeric >= 2) {
      return FALLBACK_PRIORITY_RADIUS.medium;
    }
    return FALLBACK_PRIORITY_RADIUS.low;
  }

  switch (normalizeText(priority)) {
    case "critical":
      return FALLBACK_PRIORITY_RADIUS.critical;
    case "high":
      return FALLBACK_PRIORITY_RADIUS.high;
    case "medium":
      return FALLBACK_PRIORITY_RADIUS.medium;
    default:
      return FALLBACK_PRIORITY_RADIUS.low;
  }
};

export const resolveFeatureLabel = (feature: MapFeature | undefined, property?: string, fallback?: string) => {
  if (property) {
    const value = readFeatureProperty(feature, property);
    if (value !== undefined && value !== null && String(value).trim().length > 0) {
      return String(value);
    }
  }

  return fallback ?? null;
};

const resolvePriorityRule = (
  rule: Extract<MapDataDrivenStyle, { kind: "byPriority" }>,
  feature: MapFeature | undefined
) => {
  const value = readFeatureProperty(feature, rule.property ?? "priority");
  if (value === undefined || value === null || value === "") {
    return rule.fallback;
  }

  const size = resolvePrioritySize(value);
  const channel = rule.channel ?? "radius";

  return {
    [channel]: size
  } as Partial<MapVisualStyle>;
};

const resolveStatusRule = (
  rule: Extract<MapDataDrivenStyle, { kind: "byStatus" }>,
  feature: MapFeature | undefined
) => {
  const value = readFeatureProperty(feature, rule.property ?? "status");
  if (value === undefined || value === null || value === "") {
    return rule.fallback;
  }

  return {
    fillColor: resolveStatusColor(value)
  };
};

const resolveCategoryRule = (
  rule: Extract<MapDataDrivenStyle, { kind: "byCategory" }>,
  feature: MapFeature | undefined
) => {
  const value = readFeatureProperty(feature, rule.property ?? "category");
  if (value === undefined || value === null || value === "") {
    return rule.fallback;
  }

  return {
    fillColor: resolveCategoryColor(value)
  };
};

const ruleMatchesContext = (
  rule: MapDataDrivenStyle,
  state: MapFeatureState,
  context: MapStyleResolverContext
) => {
  if (rule.when?.states?.length && !rule.when.states.includes(state)) {
    return false;
  }

  if (rule.when?.viewModes?.length && !rule.when.viewModes.includes(context.viewMode ?? "")) {
    return false;
  }

  return true;
};

const resolveDataDrivenRule = (
  rule: MapDataDrivenStyle,
  feature: MapFeature | undefined
): Partial<MapVisualStyle> | undefined => {
  switch (rule.kind) {
    case "byProperty":
      return resolvePropertyRule(rule, feature);
    case "byStatus":
      return resolveStatusRule(rule, feature);
    case "byCategory":
      return resolveCategoryRule(rule, feature);
    case "byPriority":
      return resolvePriorityRule(rule, feature);
    case "byRange":
      return resolveRangeRule(rule, feature);
    default:
      return undefined;
  }
};

const getStateOverride = (rule: MapLayerStyleRule, state: MapFeatureState) => {
  switch (state) {
    case "hover":
      return rule.hover;
    case "selected":
      return rule.selected;
    case "disabled":
      return rule.disabled;
    case "inactive":
      return rule.inactive;
    case "focused":
      return rule.focused;
    case "error":
      return rule.error;
    default:
      return undefined;
  }
};

const resolveFeatureState = (
  explicitState: MapFeatureState | undefined,
  context: MapStyleResolverContext
): MapFeatureState => {
  if (explicitState && explicitState !== "default") {
    return explicitState;
  }

  if (context.disabled || context.hidden) {
    return "disabled";
  }

  if (context.focused) {
    return "focused";
  }

  if (context.selected) {
    return "selected";
  }

  if (context.hovered) {
    return "hover";
  }

  if (context.inactive) {
    return "inactive";
  }

  return "default";
};

const resolveStyleChannels = (
  style: Partial<MapVisualStyle>,
  context: MapStyleResolverContext
): ResolvedMapVisualStyle => {
  const resolved: ResolvedMapVisualStyle = {};

  for (const [channel, value] of Object.entries(style) as Array<[keyof MapVisualStyle, MapStyleValue<unknown>]>) {
    const nextValue = resolveStyleValue(value, context);
    if (nextValue !== undefined) {
      resolved[channel] = nextValue as never;
    }
  }

  return resolved;
};

export const resolveMapStyle = ({
  layerStyle,
  feature,
  state,
  context = {}
}: {
  layerStyle: MapLayerStyleRule;
  feature?: MapFeature;
  state?: MapFeatureState;
  context?: Omit<MapStyleResolverContext, "feature" | "state">;
}): ResolvedMapVisualStyle => {
  const nextContext: MapStyleResolverContext = {
    ...context,
    feature
  };
  const resolvedState = resolveFeatureState(state, nextContext);
  nextContext.state = resolvedState;

  let style: Partial<MapVisualStyle> = layerStyle.default;

  if (context?.viewMode && layerStyle.variants?.[context.viewMode]) {
    style = mergeStyle(style, layerStyle.variants[context.viewMode]);
  }

  for (const rule of layerStyle.dataDriven ?? []) {
    if (!ruleMatchesContext(rule, resolvedState, nextContext)) {
      continue;
    }

    style = mergeStyle(style, resolveDataDrivenRule(rule, feature));
  }

  style = mergeStyle(style, getStateOverride(layerStyle, resolvedState));

  if (layerStyle.labelRule) {
    style = mergeStyle(style, {
      label: resolveFeatureLabel(feature, layerStyle.labelRule.property, layerStyle.labelRule.fallback)
    });
  }

  return resolveStyleChannels(style, nextContext);
};

const resolveLayerStyleKey = (layerConfig: MapLayerConfig | null | undefined) =>
  (layerConfig?.mapStyleKey ?? layerConfig?.id) as MapStyleKey | undefined;

export const resolveMapStyleForLayer = (
  layerConfig: MapLayerConfig | null | undefined,
  feature?: MapFeature,
  context: Omit<MapLayerResolverContext, "feature" | "layerId"> = {}
) => {
  const styleKey = resolveLayerStyleKey(layerConfig);
  const sharedRule = styleKey ? mapStyleRegistry[styleKey] : undefined;
  if (!sharedRule) {
    return {};
  }

  return resolveMapStyle({
    layerStyle: sharedRule,
    feature,
    context: {
      ...context,
      layerId: layerConfig?.id
    }
  });
};

export const resolveMapStyleByKey = (
  styleKey: string | null | undefined,
  feature?: MapFeature,
  context: Omit<MapStyleResolverContext, "feature" | "layerId" | "state"> = {},
  state?: MapFeatureState
) => {
  const sharedRule = styleKey ? mapStyleRegistry[styleKey as MapStyleKey] : undefined;
  if (!sharedRule) {
    return {};
  }

  return resolveMapStyle({
    layerStyle: sharedRule,
    feature,
    state,
    context
  });
};

export const resolveLegendSwatchForLayer = (
  layerConfig: MapLayerConfig | null | undefined,
  context: Omit<MapLayerResolverContext, "feature" | "layerId"> = {}
) => {
  const styleKey = resolveLayerStyleKey(layerConfig);
  const sharedRule = styleKey ? mapStyleRegistry[styleKey] : undefined;
  if (!sharedRule) {
    return null;
  }

  return toLegendSwatchStyle(
    resolveMapStyle({
      layerStyle: sharedRule,
      context: {
        ...context,
        layerId: layerConfig?.id
      }
    }),
    sharedRule.geometryType
  );
};

export const resolveLegendSwatchForStyleKey = (
  styleKey: string | null | undefined,
  context: Omit<MapStyleResolverContext, "feature" | "layerId" | "state"> = {}
) => {
  const sharedRule = styleKey ? mapStyleRegistry[styleKey as MapStyleKey] : undefined;
  if (!sharedRule) {
    return null;
  }

  return toLegendSwatchStyle(
    resolveMapStyle({
      layerStyle: sharedRule,
      context
    }),
    sharedRule.geometryType
  );
};
