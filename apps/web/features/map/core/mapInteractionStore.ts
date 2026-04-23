import type { FeatureSelectionState } from "@/features/map/core/interactionTypes";
import { createInitialInteractionState } from "@/features/map/core/interactionTypes";

type Listener = () => void;

export class MapInteractionStore {
  private state: FeatureSelectionState = createInitialInteractionState();
  private readonly listeners = new Set<Listener>();

  getState() {
    return this.state;
  }

  setState(nextState: FeatureSelectionState) {
    this.state = nextState;
    this.emit();
  }

  patchState(partialState: Partial<FeatureSelectionState>) {
    this.state = {
      ...this.state,
      ...partialState
    };
    this.emit();
  }

  reset() {
    this.state = createInitialInteractionState();
    this.emit();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
}
