import type {
  MapFeature,
  MapFeatureCollection,
  MapFeatureId
} from "@/features/map/core/MapTypes";

type MapFeaturePatch = Partial<MapFeature> & {
  properties?: Record<string, unknown>;
};

const featureMatchesId = (feature: MapFeature, featureId: MapFeatureId) =>
  feature.id === featureId || feature.properties?.id === featureId;

export const patchFeatureCollection = (
  collection: MapFeatureCollection,
  featureId: MapFeatureId,
  patch: MapFeaturePatch
) => ({
  ...collection,
  features: collection.features.map((feature) => {
    if (!featureMatchesId(feature, featureId)) {
      return feature;
    }

    return {
      ...feature,
      ...patch,
      properties: {
        ...(feature.properties ?? {}),
        ...(patch.properties ?? {})
      }
    };
  })
});
