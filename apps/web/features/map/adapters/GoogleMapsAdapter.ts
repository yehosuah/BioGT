import { UnavailableProviderAdapter } from "@/features/map/adapters/UnavailableProviderAdapter";

export class GoogleMapsAdapter extends UnavailableProviderAdapter {
  constructor() {
    super("google");
  }
}
