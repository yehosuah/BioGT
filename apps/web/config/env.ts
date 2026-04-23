import type { MapProviderName } from "@/features/map/core/MapTypes";

export type ClientMapProvider = "null" | "mapbox" | "maplibre" | "google" | "leaflet" | "arcgis";
export type AppEnvironmentName = "development" | "staging" | "production" | "test";

export type AppEnv = {
  appEnv: AppEnvironmentName;
  map: {
    provider: ClientMapProvider;
    defaultCenter: {
      lat: number;
      lng: number;
    };
    defaultZoom: number;
    mapboxToken?: string;
    googleMapsKey?: string;
    arcgisApiKey?: string;
    mapStyleUrl?: string;
    tileUrlTemplate?: string;
    debug: boolean;
    telemetry: boolean;
    fixtureMode: boolean;
  };
};

export type EnvValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

const DEFAULT_LAT = 14.6349;
const DEFAULT_LNG = -90.5069;
const DEFAULT_ZOOM = 12;
const DEFAULT_MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const VALID_PROVIDERS = new Set<ClientMapProvider>([
  "null",
  "mapbox",
  "maplibre",
  "google",
  "leaflet",
  "arcgis"
]);
const RUNTIME_IMPLEMENTED_PROVIDERS = new Set<ClientMapProvider>(["maplibre", "null"]);

type EnvSource = Record<string, string | undefined>;

const normalizeAppEnv = (value: string | undefined): AppEnvironmentName => {
  if (value === "production" || value === "staging" || value === "test") {
    return value;
  }

  return "development";
};

const readString = (source: EnvSource, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

const parseNumber = (value: string | undefined, fallback: number) => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const normalizeProvider = (value: string | undefined): ClientMapProvider => {
  if (!value) {
    return "maplibre";
  }

  if (VALID_PROVIDERS.has(value as ClientMapProvider)) {
    return value as ClientMapProvider;
  }

  return value as ClientMapProvider;
};

export const createAppEnv = (source: EnvSource = process.env): AppEnv => {
  const appEnv = normalizeAppEnv(readString(source, "NEXT_PUBLIC_APP_ENV", "NODE_ENV"));
  const provider = normalizeProvider(readString(source, "NEXT_PUBLIC_MAP_PROVIDER"));

  return {
    appEnv,
    map: {
      provider,
      defaultCenter: {
        lat: parseNumber(
          readString(source, "NEXT_PUBLIC_DEFAULT_LAT", "NEXT_PUBLIC_DEFAULT_MAP_LATITUDE"),
          DEFAULT_LAT
        ),
        lng: parseNumber(
          readString(source, "NEXT_PUBLIC_DEFAULT_LNG", "NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE"),
          DEFAULT_LNG
        )
      },
      defaultZoom: parseNumber(
        readString(source, "NEXT_PUBLIC_DEFAULT_ZOOM", "NEXT_PUBLIC_DEFAULT_MAP_ZOOM"),
        DEFAULT_ZOOM
      ),
      mapboxToken: readString(source, "NEXT_PUBLIC_MAPBOX_TOKEN"),
      googleMapsKey: readString(source, "NEXT_PUBLIC_GOOGLE_MAPS_KEY"),
      arcgisApiKey: readString(source, "NEXT_PUBLIC_ARCGIS_API_KEY"),
      mapStyleUrl: readString(source, "NEXT_PUBLIC_MAP_STYLE_URL") ?? DEFAULT_MAP_STYLE_URL,
      tileUrlTemplate: readString(source, "NEXT_PUBLIC_TILE_URL_TEMPLATE"),
      debug: parseBoolean(readString(source, "NEXT_PUBLIC_ENABLE_MAP_DEBUG"), appEnv !== "production"),
      telemetry: parseBoolean(
        readString(source, "NEXT_PUBLIC_ENABLE_MAP_TELEMETRY"),
        appEnv !== "production"
      ),
      fixtureMode: parseBoolean(readString(source, "NEXT_PUBLIC_MAP_FIXTURE_MODE"), false)
    }
  };
};

export const appEnv = createAppEnv();

export const validateMapEnvironment = (env: AppEnv = appEnv): EnvValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!VALID_PROVIDERS.has(env.map.provider)) {
    errors.push(
      `Invalid map provider "${env.map.provider}". Expected one of: ${Array.from(VALID_PROVIDERS).join(", ")}.`
    );
  }

  if (!Number.isFinite(env.map.defaultCenter.lat) || !Number.isFinite(env.map.defaultCenter.lng)) {
    errors.push("Default map center must use finite latitude and longitude values.");
  }

  if (!Number.isFinite(env.map.defaultZoom) || env.map.defaultZoom < 0 || env.map.defaultZoom > 22) {
    errors.push("Default map zoom must be a finite number between 0 and 22.");
  }

  if (VALID_PROVIDERS.has(env.map.provider) && !RUNTIME_IMPLEMENTED_PROVIDERS.has(env.map.provider)) {
    errors.push(
      `Provider "${env.map.provider}" is recognized but not implemented in current runtime. Supported runtime providers: ${Array.from(RUNTIME_IMPLEMENTED_PROVIDERS).join(", ")}.`
    );
  }

  if (env.map.provider === "mapbox" && !env.map.mapboxToken) {
    errors.push("NEXT_PUBLIC_MAPBOX_TOKEN is required when NEXT_PUBLIC_MAP_PROVIDER=mapbox.");
  }

  if (env.map.provider === "google" && !env.map.googleMapsKey) {
    errors.push("NEXT_PUBLIC_GOOGLE_MAPS_KEY is required when NEXT_PUBLIC_MAP_PROVIDER=google.");
  }

  if (env.map.provider === "arcgis" && !env.map.arcgisApiKey) {
    errors.push("NEXT_PUBLIC_ARCGIS_API_KEY is required when NEXT_PUBLIC_MAP_PROVIDER=arcgis.");
  }

  if (env.map.provider === "leaflet" && !env.map.tileUrlTemplate) {
    errors.push("NEXT_PUBLIC_TILE_URL_TEMPLATE is required when NEXT_PUBLIC_MAP_PROVIDER=leaflet.");
  }

  if (env.map.provider === "maplibre" && !env.map.mapStyleUrl && !env.map.tileUrlTemplate) {
    errors.push(
      "NEXT_PUBLIC_MAP_STYLE_URL or NEXT_PUBLIC_TILE_URL_TEMPLATE is required when NEXT_PUBLIC_MAP_PROVIDER=maplibre."
    );
  }

  if (env.map.provider === "maplibre" && env.map.mapStyleUrl === DEFAULT_MAP_STYLE_URL) {
    warnings.push("Using default public MapLibre style URL. Restrict provider keys and validate usage terms before production.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

export const getMissingPublicEnvVars = (env: AppEnv = appEnv) => {
  const missing: string[] = [];

  if (env.map.provider === "mapbox" && !env.map.mapboxToken) {
    missing.push("NEXT_PUBLIC_MAPBOX_TOKEN");
  }
  if (env.map.provider === "google" && !env.map.googleMapsKey) {
    missing.push("NEXT_PUBLIC_GOOGLE_MAPS_KEY");
  }
  if (env.map.provider === "arcgis" && !env.map.arcgisApiKey) {
    missing.push("NEXT_PUBLIC_ARCGIS_API_KEY");
  }
  if (env.map.provider === "leaflet" && !env.map.tileUrlTemplate) {
    missing.push("NEXT_PUBLIC_TILE_URL_TEMPLATE");
  }
  if (env.map.provider === "maplibre" && !env.map.mapStyleUrl && !env.map.tileUrlTemplate) {
    missing.push("NEXT_PUBLIC_MAP_STYLE_URL", "NEXT_PUBLIC_TILE_URL_TEMPLATE");
  }

  return missing;
};

export const toRuntimeMapProvider = (provider: ClientMapProvider): MapProviderName =>
  provider;
