import type { Geometry } from "geojson";

import type {
  MapFeature,
  MapFeatureCollection,
  MapGeometryType,
  MapLayerConfig
} from "@/features/map/core/MapTypes";

export interface LayerFeatureValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingRequiredProperties: string[];
  unsupportedGeometry: boolean;
}

export interface LayerFeatureCollectionValidationResult extends LayerFeatureValidationResult {
  featureErrors: Array<{
    index: number;
    id?: string;
    errors: string[];
    missingRequiredProperties: string[];
  }>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const geometryMatchesLayerType = (geometryType: Geometry["type"], layerType: MapGeometryType) => {
  if (layerType === "mixed") {
    return true;
  }

  if (layerType === "point") {
    return geometryType === "Point" || geometryType === "MultiPoint";
  }

  if (layerType === "line") {
    return geometryType === "LineString" || geometryType === "MultiLineString";
  }

  return geometryType === "Polygon" || geometryType === "MultiPolygon";
};

const getAllowedGeometryTypes = (layerConfig: MapLayerConfig) =>
  layerConfig.validation?.allowedGeometryTypes ??
  (layerConfig.geometryType === "mixed"
    ? (["Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon"] satisfies Array<Geometry["type"]>)
    : undefined);

const maybeWarn = (layerId: string, errors: string[]) => {
  if (process.env.NODE_ENV === "production" || errors.length === 0) {
    return;
  }

  console.warn(`[map-layer-registry] ${layerId}: ${errors.join(" | ")}`);
};

export const validateFeatureForLayer = (
  feature: unknown,
  layerConfig: MapLayerConfig | null | undefined
): LayerFeatureValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingRequiredProperties: string[] = [];

  if (!layerConfig) {
    return {
      valid: false,
      errors: ["Unknown layer configuration"],
      warnings,
      missingRequiredProperties,
      unsupportedGeometry: false
    };
  }

  if (!isObject(feature)) {
    return {
      valid: false,
      errors: ["Feature must be an object"],
      warnings,
      missingRequiredProperties,
      unsupportedGeometry: false
    };
  }

  if (feature.type !== "Feature") {
    errors.push('Feature type must equal "Feature"');
  }

  const properties = isObject(feature.properties) ? feature.properties : null;
  if (!properties) {
    errors.push("Feature properties must be an object");
  } else {
    layerConfig.requiredProperties.forEach((key) => {
      if (!(key in properties) || properties[key] === null || properties[key] === undefined) {
        missingRequiredProperties.push(key);
      }
    });
  }

  const geometry = isObject(feature.geometry) ? feature.geometry : null;
  let unsupportedGeometry = false;
  if (!geometry || typeof geometry.type !== "string") {
    errors.push("Feature geometry must be a GeoJSON geometry");
  } else {
    const allowedGeometryTypes = getAllowedGeometryTypes(layerConfig);
    const geometryType = geometry.type as Geometry["type"];
    unsupportedGeometry =
      !geometryMatchesLayerType(geometryType, layerConfig.geometryType) ||
      (Array.isArray(allowedGeometryTypes) && !allowedGeometryTypes.includes(geometryType));

    if (unsupportedGeometry) {
      errors.push(`Unsupported geometry "${geometry.type}" for layer "${layerConfig.id}"`);
    }
  }

  if (missingRequiredProperties.length > 0) {
    errors.push(`Missing required properties: ${missingRequiredProperties.join(", ")}`);
  }

  const result = {
    valid: errors.length === 0,
    errors,
    warnings,
    missingRequiredProperties,
    unsupportedGeometry
  };

  if (!result.valid) {
    maybeWarn(layerConfig.id, result.errors);
  }

  return result;
};

export const validateFeatureCollectionForLayer = (
  collection: unknown,
  layerConfig: MapLayerConfig | null | undefined
): LayerFeatureCollectionValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingRequiredProperties: string[] = [];
  const featureErrors: LayerFeatureCollectionValidationResult["featureErrors"] = [];

  if (!layerConfig) {
    return {
      valid: false,
      errors: ["Unknown layer configuration"],
      warnings,
      missingRequiredProperties,
      unsupportedGeometry: false,
      featureErrors
    };
  }

  if (!isObject(collection)) {
    return {
      valid: false,
      errors: ["FeatureCollection must be an object"],
      warnings,
      missingRequiredProperties,
      unsupportedGeometry: false,
      featureErrors
    };
  }

  if (collection.type !== "FeatureCollection") {
    errors.push('FeatureCollection type must equal "FeatureCollection"');
  }

  if (!Array.isArray(collection.features)) {
    errors.push("FeatureCollection features must be an array");
    return {
      valid: false,
      errors,
      warnings,
      missingRequiredProperties,
      unsupportedGeometry: false,
      featureErrors
    };
  }

  let unsupportedGeometry = false;

  collection.features.forEach((feature, index) => {
    const result = validateFeatureForLayer(feature, layerConfig);
    if (result.valid) {
      return;
    }

    const featureId =
      isObject(feature) && isObject(feature.properties) && typeof feature.properties.id === "string"
        ? feature.properties.id
        : typeof feature?.id === "string"
          ? feature.id
          : undefined;

    unsupportedGeometry = unsupportedGeometry || result.unsupportedGeometry;
    missingRequiredProperties.push(...result.missingRequiredProperties);
    featureErrors.push({
      index,
      id: featureId,
      errors: result.errors,
      missingRequiredProperties: result.missingRequiredProperties
    });

    result.errors.forEach((error) => {
      const prefix = featureId
        ? `Feature at index ${index} (${featureId})`
        : `Feature at index ${index}`;
      errors.push(`${prefix}: ${error}`);
    });
  });

  const dedupedMissingRequiredProperties = Array.from(new Set(missingRequiredProperties));
  const response = {
    valid: errors.length === 0,
    errors,
    warnings,
    missingRequiredProperties: dedupedMissingRequiredProperties,
    unsupportedGeometry,
    featureErrors
  };

  if (!response.valid) {
    maybeWarn(layerConfig.id, response.errors);
  }

  return response;
};

export const isFeatureCollectionValidForLayer = (
  collection: MapFeatureCollection,
  layerConfig: MapLayerConfig | null | undefined
) => validateFeatureCollectionForLayer(collection, layerConfig).valid;

export const isFeatureValidForLayer = (
  feature: MapFeature,
  layerConfig: MapLayerConfig | null | undefined
) => validateFeatureForLayer(feature, layerConfig).valid;
