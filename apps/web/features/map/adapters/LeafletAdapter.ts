import { UnavailableProviderAdapter } from "@/features/map/adapters/UnavailableProviderAdapter";

export class LeafletAdapter extends UnavailableProviderAdapter {
  constructor() {
    super("leaflet");
  }
}
