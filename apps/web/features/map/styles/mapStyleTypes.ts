import type { MapFeature } from "@/features/map/core/MapTypes";

export type MapStyleGeometryType =
  | "point"
  | "line"
  | "polygon"
  | "heatmap"
  | "raster"
  | "symbol"
  | "custom";

export type MapFeatureState =
  | "default"
  | "hover"
  | "selected"
  | "disabled"
  | "inactive"
  | "focused"
  | "error";

export interface MapStyleResolverContext {
  feature?: MapFeature;
  layerId?: string;
  zoom?: number;
  viewMode?: string;
  selected?: boolean;
  hovered?: boolean;
  disabled?: boolean;
  inactive?: boolean;
  focused?: boolean;
  hidden?: boolean;
  state?: MapFeatureState;
}

export type MapStyleValue<T> = T | ((context: MapStyleResolverContext) => T | undefined);

export interface MapLabelRule {
  property?: string;
  fallback?: string;
}

export interface MapVisualStyle {
  fillColor?: MapStyleValue<string>;
  strokeColor?: MapStyleValue<string>;
  strokeWidth?: MapStyleValue<number>;
  opacity?: MapStyleValue<number>;
  fillOpacity?: MapStyleValue<number>;
  icon?: MapStyleValue<string | null>;
  iconSize?: MapStyleValue<number>;
  iconColor?: MapStyleValue<string>;
  label?: MapStyleValue<string | null>;
  labelColor?: MapStyleValue<string>;
  labelSize?: MapStyleValue<number>;
  zIndex?: MapStyleValue<number>;
  radius?: MapStyleValue<number>;
  dashArray?: MapStyleValue<number[]>;
  surfaceColor?: MapStyleValue<string>;
  textColor?: MapStyleValue<string>;
  badgeColor?: MapStyleValue<string>;
  badgeTextColor?: MapStyleValue<string>;
}

export type ResolvedMapVisualStyle = {
  [Channel in keyof MapVisualStyle]?: MapVisualStyle[Channel] extends MapStyleValue<infer TValue>
    ? TValue
    : never;
};

type MapRuleCondition = {
  viewModes?: string[];
  states?: MapFeatureState[];
};

type MapDataDrivenRuleBase = {
  property?: string;
  fallback?: Partial<MapVisualStyle>;
  when?: MapRuleCondition;
};

export type MapDataDrivenStyle =
  | (MapDataDrivenRuleBase & {
      kind: "byProperty";
      mapping: Record<string, Partial<MapVisualStyle>>;
    })
  | (MapDataDrivenRuleBase & {
      kind: "byStatus";
    })
  | (MapDataDrivenRuleBase & {
      kind: "byCategory";
    })
  | (MapDataDrivenRuleBase & {
      kind: "byPriority";
      channel?: "radius" | "strokeWidth" | "iconSize" | "opacity";
    })
  | (MapDataDrivenRuleBase & {
      kind: "byRange";
      property: string;
      ranges: Array<{
        min?: number;
        max?: number;
        style: Partial<MapVisualStyle>;
      }>;
    });

export interface MapLayerStyleRule {
  geometryType: MapStyleGeometryType;
  default: MapVisualStyle;
  variants?: Record<string, Partial<MapVisualStyle>>;
  hover?: Partial<MapVisualStyle>;
  selected?: Partial<MapVisualStyle>;
  disabled?: Partial<MapVisualStyle>;
  inactive?: Partial<MapVisualStyle>;
  focused?: Partial<MapVisualStyle>;
  error?: Partial<MapVisualStyle>;
  dataDriven?: MapDataDrivenStyle[];
  labelRule?: MapLabelRule;
}
