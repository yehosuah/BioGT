import { filterFeatureCollection, groupFeaturesByProperty } from "@/features/map/data/geo/featureCollection";
import { normalizeRawLocationRecord } from "@/features/map/data/geo/normalize";
import { validateFeature, validateFeatureCollection } from "@/features/map/data/geo/validation";
import type {
  BaseMapProperties,
  MapFeature,
  MapFeatureCollection,
  NormalizedMapRecord,
  RawRecordTransformOptions,
  Result
} from "@/features/map/data/geo/types";

export function recordToFeature(record: NormalizedMapRecord): MapFeature {
  return {
    id: record.id,
    type: "Feature",
    geometry: record.geometry,
    properties: {
      ...(record.metadata ?? {}),
      id: record.id,
      name: record.name,
      category: record.category,
      status: record.status,
      ...(record.source ? { source: record.source } : {}),
      ...(record.updatedAt ? { updatedAt: record.updatedAt } : {})
    } satisfies BaseMapProperties
  };
}

export function recordsToFeatureCollection(
  records: readonly NormalizedMapRecord[],
  options: Pick<RawRecordTransformOptions, "skipInvalid"> = {}
): Result<MapFeatureCollection> {
  const features: MapFeature[] = [];
  const errors: string[] = [];

  records.forEach((record, index) => {
    const feature = recordToFeature(record);
    const featureValidation = validateFeature(feature);

    if (!featureValidation.valid) {
      if (!options.skipInvalid) {
        featureValidation.errors.forEach((error) => {
          errors.push(`Record at index ${index} (${record.id}): ${error}`);
        });
      }
      return;
    }

    features.push(feature);
  });

  if (errors.length > 0) {
    return {
      ok: false,
      errors
    };
  }

  const collection: MapFeatureCollection = {
    type: "FeatureCollection",
    features
  };
  const collectionValidation = validateFeatureCollection(collection);

  if (!collectionValidation.valid && !options.skipInvalid) {
    return {
      ok: false,
      errors: collectionValidation.errors
    };
  }

  return {
    ok: true,
    data: collection
  };
}

export function rawRecordsToFeatureCollection(
  rawRecords: readonly unknown[],
  options: RawRecordTransformOptions = {}
): Result<MapFeatureCollection> {
  const records: NormalizedMapRecord[] = [];
  const errors: string[] = [];

  rawRecords.forEach((rawRecord, index) => {
    const normalizeResult = normalizeRawLocationRecord(rawRecord, options);

    if (!normalizeResult.ok) {
      if (!options.skipInvalid) {
        normalizeResult.errors.forEach((error) => {
          errors.push(`Raw record at index ${index}: ${error}`);
        });
      }
      return;
    }

    records.push(normalizeResult.data);
  });

  if (errors.length > 0) {
    return {
      ok: false,
      errors
    };
  }

  return recordsToFeatureCollection(records, options);
}

export { filterFeatureCollection, groupFeaturesByProperty, normalizeRawLocationRecord };
