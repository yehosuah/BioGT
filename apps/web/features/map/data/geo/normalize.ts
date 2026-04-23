import { isValidGeometry, isValidLngLat } from "@/features/map/data/geo/validation";
import type {
  LngLat,
  MapGeometry,
  NormalizedMapRecord,
  RawRecordTransformOptions,
  Result
} from "@/features/map/data/geo/types";

const RESERVED_KEYS = new Set([
  "id",
  "_id",
  "uuid",
  "name",
  "title",
  "label",
  "category",
  "type",
  "kind",
  "status",
  "state",
  "source",
  "provider",
  "origin",
  "updatedAt",
  "updated_at",
  "modifiedAt",
  "modified_at",
  "lat",
  "lng",
  "latitude",
  "longitude",
  "lon",
  "long",
  "coordinates",
  "geometry",
  "metadata"
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const coerceString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
};

const pickString = (record: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = coerceString(record[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
};

const normalizeUpdatedAt = (record: Record<string, unknown>): string | undefined => {
  const updatedAt = record.updatedAt ?? record.updated_at ?? record.modifiedAt ?? record.modified_at;

  if (typeof updatedAt === "string" && updatedAt.trim().length > 0) {
    return updatedAt;
  }

  if (updatedAt instanceof Date && Number.isFinite(updatedAt.valueOf())) {
    return updatedAt.toISOString();
  }

  return undefined;
};

const extractCoordinatesFromObject = (value: Record<string, unknown>): LngLat | undefined => {
  const longitude = value.lng ?? value.longitude ?? value.lon ?? value.long;
  const latitude = value.lat ?? value.latitude;
  const coordinates: unknown = [longitude, latitude];
  return isValidLngLat(coordinates) ? coordinates : undefined;
};

const extractGeometry = (record: Record<string, unknown>): Result<MapGeometry> => {
  if (record.geometry !== undefined) {
    if (isValidGeometry(record.geometry)) {
      return { ok: true, data: record.geometry };
    }

    return {
      ok: false,
      errors: ["Raw record has invalid geometry"]
    };
  }

  if (record.coordinates !== undefined) {
    if (isValidLngLat(record.coordinates)) {
      return {
        ok: true,
        data: {
          type: "Point",
          coordinates: record.coordinates
        }
      };
    }

    if (isObject(record.coordinates)) {
      const coordinates = extractCoordinatesFromObject(record.coordinates);
      if (coordinates) {
        return {
          ok: true,
          data: {
            type: "Point",
            coordinates
          }
        };
      }
    }

    return {
      ok: false,
      errors: ["Raw record has invalid coordinates"]
    };
  }

  const pointCoordinates: unknown = [
    record.lng ?? record.longitude ?? record.lon ?? record.long,
    record.lat ?? record.latitude
  ];

  if (isValidLngLat(pointCoordinates)) {
    return {
      ok: true,
      data: {
        type: "Point",
        coordinates: pointCoordinates
      }
    };
  }

  return {
    ok: false,
    errors: ["Raw record is missing valid geometry"]
  };
};

const buildMetadata = (record: Record<string, unknown>): Record<string, unknown> | undefined => {
  const explicitMetadata = isObject(record.metadata) ? record.metadata : undefined;
  const remainingMetadata = Object.fromEntries(
    Object.entries(record).filter(([key]) => !RESERVED_KEYS.has(key))
  );

  const metadata = {
    ...remainingMetadata,
    ...explicitMetadata
  };

  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

export function normalizeRawLocationRecord(
  raw: unknown,
  options: Omit<RawRecordTransformOptions, "skipInvalid"> = {}
): Result<NormalizedMapRecord> {
  if (!isObject(raw)) {
    return {
      ok: false,
      errors: ["Raw record must be an object"]
    };
  }

  const errors: string[] = [];
  const id = pickString(raw, ["id", "_id", "uuid"]);
  const name = pickString(raw, ["name", "title", "label"]);
  const category = pickString(raw, ["category", "type", "kind"]) ?? options.defaultCategory;
  const status = pickString(raw, ["status", "state"]) ?? options.defaultStatus;
  const source = pickString(raw, ["source", "provider", "origin"]) ?? options.defaultSource;
  const updatedAt = normalizeUpdatedAt(raw);

  if (!id) {
    errors.push("Raw record is missing id");
  }

  if (!name) {
    errors.push("Raw record is missing name");
  }

  if (!category) {
    errors.push("Raw record is missing category");
  }

  if (!status) {
    errors.push("Raw record is missing status");
  }

  const geometryResult = extractGeometry(raw);
  if (!geometryResult.ok) {
    errors.push(...geometryResult.errors);
  }

  if (errors.length > 0 || !geometryResult.ok) {
    return {
      ok: false,
      errors
    };
  }

  return {
    ok: true,
    data: {
      id: id!,
      name: name!,
      category: category!,
      status: status!,
      geometry: geometryResult.data,
      source,
      updatedAt,
      metadata: buildMetadata(raw)
    }
  };
}
