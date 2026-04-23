import { UnavailableProviderAdapter } from "@/features/map/adapters/UnavailableProviderAdapter";

export class ArcGISAdapter extends UnavailableProviderAdapter {
  constructor() {
    super("arcgis");
  }
}
