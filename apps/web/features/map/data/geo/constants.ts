export const SUPPORTED_GEOMETRY_TYPES = [
  "Point",
  "LineString",
  "Polygon",
  "MultiPoint",
  "MultiLineString",
  "MultiPolygon"
] as const;

export const REQUIRED_MAP_PROPERTY_KEYS = ["id", "name", "category", "status"] as const;

export const UNGROUPED_PROPERTY_KEY = "__undefined__";
