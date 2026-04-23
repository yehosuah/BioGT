import type { MapEventName } from "@/observability/mapTelemetry";
import { trackMapEvent } from "@/observability/mapTelemetry";

export type MapMetricName = MapEventName;
type MapMetricPayload = Record<string, unknown>;

export const getMapMetricTime = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export const trackMapMetric = (name: MapMetricName, payload: MapMetricPayload = {}) =>
  trackMapEvent(name, payload);
