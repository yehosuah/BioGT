import { appEnv } from "@/config/env";
import { ArcGISAdapter } from "@/features/map/adapters/ArcGISAdapter";
import { GoogleMapsAdapter } from "@/features/map/adapters/GoogleMapsAdapter";
import { LeafletAdapter } from "@/features/map/adapters/LeafletAdapter";
import { MapboxAdapter } from "@/features/map/adapters/MapboxAdapter";
import { MapLibreAdapter } from "@/features/map/adapters/MapLibreAdapter";
import type { MapAdapter } from "@/features/map/core/MapAdapter";
import type { MapProviderName } from "@/features/map/core/MapTypes";

type CreateMapAdapterOptions = {
  provider?: string | null;
};

export const resolveConfiguredMapProvider = (
  provider: string | null | undefined = appEnv.map.provider
): MapProviderName => {
  const normalizedProvider = String(provider).trim().toLowerCase();

  if (!normalizedProvider) {
    return "maplibre";
  }

  if (normalizedProvider === "google-maps") {
    return "google";
  }

  return normalizedProvider as MapProviderName;
};

export const createMapAdapter = ({
  provider
}: CreateMapAdapterOptions = {}): MapAdapter => {
  const resolvedProvider = resolveConfiguredMapProvider(provider ?? undefined);

  switch (resolvedProvider) {
    case "maplibre":
      return new MapLibreAdapter();
    case "mapbox":
      return new MapboxAdapter();
    case "leaflet":
      return new LeafletAdapter();
    case "google":
      return new GoogleMapsAdapter();
    case "arcgis":
      return new ArcGISAdapter();
    default:
      throw new Error(
        `Unsupported map provider "${resolvedProvider}". Supported providers: mapbox, maplibre, leaflet, google, arcgis.`
      );
  }
};
