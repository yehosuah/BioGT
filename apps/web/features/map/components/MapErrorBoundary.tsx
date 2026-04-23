"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { logger } from "@/observability/logger";
import { trackMapEvent } from "@/observability/mapTelemetry";
import { MapOperationalBoundary } from "@/features/map/components/MapOperationalBoundary";

type MapErrorBoundaryProps = {
  children: ReactNode;
};

type MapErrorBoundaryState = {
  error: Error | null;
};

export class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  override state: MapErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): MapErrorBoundaryState {
    return {
      error
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("Map render boundary caught runtime error.", error, {
      componentStack: errorInfo.componentStack
    });
    trackMapEvent("map_failed", {
      errorName: error.name,
      errorMessage: error.message
    });
  }

  override render() {
    if (this.state.error) {
      return (
        <MapOperationalBoundary
          failure={{
            kind: "runtime",
            message: this.state.error.message
          }}
        />
      );
    }

    return this.props.children;
  }
}
