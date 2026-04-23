import { UnavailableProviderAdapter } from "@/features/map/adapters/UnavailableProviderAdapter";

export class MapboxAdapter extends UnavailableProviderAdapter {
  constructor() {
    super("mapbox");
  }
}
