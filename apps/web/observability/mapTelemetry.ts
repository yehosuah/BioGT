import { appEnv } from "@/config/env";
import { sanitizeForLog } from "@/observability/logger";

export type MapEventName =
  | "map_preflight_started"
  | "map_preflight_failed"
  | "map_preflight_passed"
  | "map_initialization_started"
  | "map_loaded"
  | "map_failed"
  | "map_destroyed"
  | "layer_load_started"
  | "layer_loaded"
  | "layer_failed"
  | "layer_data_updated"
  | "feature_clicked"
  | "filter_applied"
  | "bounds_changed"
  | "search_used"
  | "large_dataset_warning"
  | "provider_usage_warning"
  | "map_provider_load_start"
  | "map_provider_load_end"
  | "map_initial_render_start"
  | "map_initial_render_end"
  | "layer_load_start"
  | "layer_load_end"
  | "layer_load_error"
  | "layer_feature_count"
  | "layer_strategy_selected"
  | "viewport_query_start"
  | "viewport_query_end"
  | "cache_hit"
  | "cache_miss"
  | "too_large_dataset_blocked";

type TelemetryPayload = Record<string, unknown>;
type TelemetrySink = (eventName: MapEventName, payload: TelemetryPayload) => void;

const sinks = new Set<TelemetrySink>();
const blockedKeyPattern =
  /(^|_)(coordinates?|geometry|geojson|latitude|longitude|lat|lng|bbox|bounds|url|href|query|token|key|access_token|api_key)$/i;
const allowedPrimitive = (value: unknown) =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const isGeoJsonLike = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { type?: unknown };
  return (
    candidate.type === "Feature" ||
    candidate.type === "FeatureCollection" ||
    candidate.type === "GeometryCollection"
  );
};

const sanitizeEntry = (key: string, value: unknown): unknown => {
  if (blockedKeyPattern.test(key) || isGeoJsonLike(value)) {
    return undefined;
  }

  if (allowedPrimitive(value)) {
    if (key === "errorMessage" && appEnv.appEnv === "production") {
      return undefined;
    }

    return sanitizeForLog(value);
  }

  if (Array.isArray(value)) {
    const next = value
      .map((entry) => sanitizeEntry(key, entry))
      .filter((entry) => entry !== undefined);
    return next.length > 0 ? next : undefined;
  }

  if (value && typeof value === "object") {
    const sanitized = Object.fromEntries(
      Object.entries(value)
        .map(([childKey, childValue]) => [childKey, sanitizeEntry(childKey, childValue)])
        .filter(([, childValue]) => childValue !== undefined)
    );

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  if (value === null) {
    return null;
  }

  return undefined;
};

export const sanitizeTelemetryPayload = (payload: unknown): TelemetryPayload => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload)
      .map(([key, value]) => [key, sanitizeEntry(key, value)])
      .filter(([, value]) => value !== undefined)
  );
};

export const registerMapTelemetrySink = (sink: TelemetrySink) => {
  sinks.add(sink);
  return () => sinks.delete(sink);
};

const shouldConsoleLog = appEnv.appEnv === "development";

export const trackMapEvent = (eventName: MapEventName, payload: TelemetryPayload = {}) => {
  const sanitizedPayload = sanitizeTelemetryPayload(payload);

  if (shouldConsoleLog) {
    console.debug("[map-telemetry]", eventName, sanitizedPayload);
  }

  if (appEnv.appEnv === "production" && !appEnv.map.telemetry) {
    return;
  }

  sinks.forEach((sink) => sink(eventName, sanitizedPayload));
};
