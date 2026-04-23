import type { Position } from "geojson";

import {
  REQUIRED_MAP_PROPERTY_KEYS,
  SUPPORTED_GEOMETRY_TYPES
} from "@/features/map/data/geo/constants";
import type {
  BaseMapProperties,
  FeatureCollectionValidationResult,
  LngLat,
  MapFeature,
  MapFeatureCollection,
  MapGeometry,
  ValidationResult
} from "@/features/map/data/geo/types";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringWithContent = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const coordinatesMatch = (left: LngLat, right: LngLat) => left[0] === right[0] && left[1] === right[1];

const isLineStringCoordinates = (coordinates: unknown): coordinates is Position[] =>
  Array.isArray(coordinates) && coordinates.length >= 2 && coordinates.every((coordinate) => isValidLngLat(coordinate));

const isLinearRingCoordinates = (coordinates: unknown): coordinates is Position[] =>
  Array.isArray(coordinates) &&
  coordinates.length >= 4 &&
  coordinates.every((coordinate) => isValidLngLat(coordinate)) &&
  coordinatesMatch(coordinates[0] as LngLat, coordinates[coordinates.length - 1] as LngLat);

const isPolygonCoordinates = (coordinates: unknown): coordinates is Position[][] =>
  Array.isArray(coordinates) &&
  coordinates.length > 0 &&
  coordinates.every((ring) => isLinearRingCoordinates(ring));

export function isValidLngLat(coordinates: unknown): coordinates is LngLat {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return false;
  }

  const [longitude, latitude] = coordinates;
  return (
    isFiniteNumber(longitude) &&
    isFiniteNumber(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

export function isValidGeometry(geometry: unknown): geometry is MapGeometry {
  if (!isObject(geometry) || !("type" in geometry) || !("coordinates" in geometry)) {
    return false;
  }

  if (
    typeof geometry.type !== "string" ||
    !SUPPORTED_GEOMETRY_TYPES.includes(geometry.type as (typeof SUPPORTED_GEOMETRY_TYPES)[number])
  ) {
    return false;
  }

  switch (geometry.type) {
    case "Point":
      return isValidLngLat(geometry.coordinates);
    case "MultiPoint":
      return (
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length > 0 &&
        geometry.coordinates.every((coordinate) => isValidLngLat(coordinate))
      );
    case "LineString":
      return isLineStringCoordinates(geometry.coordinates);
    case "MultiLineString":
      return (
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length > 0 &&
        geometry.coordinates.every((line) => isLineStringCoordinates(line))
      );
    case "Polygon":
      return isPolygonCoordinates(geometry.coordinates);
    case "MultiPolygon":
      return (
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length > 0 &&
        geometry.coordinates.every((polygon) => isPolygonCoordinates(polygon))
      );
    default:
      return false;
  }
}

export function validateMapProperties(properties: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(properties)) {
    return {
      valid: false,
      errors: ["Feature properties must be an object"]
    };
  }

  REQUIRED_MAP_PROPERTY_KEYS.forEach((key) => {
    if (!isStringWithContent(properties[key])) {
      errors.push(`Feature is missing properties.${key}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateFeature(feature: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(feature)) {
    return {
      valid: false,
      errors: ["Feature must be an object"]
    };
  }

  if (feature.type !== "Feature") {
    errors.push('Feature type must equal "Feature"');
  }

  const propertyValidation = validateMapProperties(feature.properties);
  errors.push(...propertyValidation.errors);

  if (!isValidGeometry(feature.geometry)) {
    errors.push("Feature has invalid geometry");
  }

  const rootId = typeof feature.id === "string" ? feature.id : undefined;
  const propertyId =
    isObject(feature.properties) && typeof feature.properties.id === "string"
      ? feature.properties.id
      : undefined;

  if (!rootId && !propertyId) {
    errors.push("Feature is missing id");
  }

  if (rootId && propertyId && rootId !== propertyId) {
    errors.push("Feature id does not match properties.id");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateFeatureCollection(collection: unknown): FeatureCollectionValidationResult {
  const errors: string[] = [];
  const featureErrors: FeatureCollectionValidationResult["featureErrors"] = [];

  if (!isObject(collection)) {
    return {
      valid: false,
      errors: ["FeatureCollection must be an object"],
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
      featureErrors
    };
  }

  collection.features.forEach((feature, index) => {
    const featureValidation = validateFeature(feature);
    if (featureValidation.valid) {
      return;
    }

    const featureId =
      isObject(feature) && isObject(feature.properties) && typeof feature.properties.id === "string"
        ? feature.properties.id
        : typeof feature?.id === "string"
          ? feature.id
          : undefined;

    featureErrors.push({
      index,
      id: featureId,
      errors: featureValidation.errors
    });

    featureValidation.errors.forEach((error) => {
      const prefix = featureId
        ? `Feature at index ${index} (${featureId})`
        : `Feature at index ${index}`;
      errors.push(`${prefix}: ${error}`);
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    featureErrors
  };
}

export function isBaseMapProperties(value: unknown): value is BaseMapProperties {
  return validateMapProperties(value).valid;
}

export function isMapFeature(value: unknown): value is MapFeature {
  return validateFeature(value).valid;
}

export function isMapFeatureCollection(value: unknown): value is MapFeatureCollection {
  return validateFeatureCollection(value).valid;
}
