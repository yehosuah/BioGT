"use client";

import type { ReactNode } from "react";

import type { AppEnvironmentName, EnvValidationResult } from "@/config/env";
import { appEnv } from "@/config/env";
import { sanitizeForLog } from "@/observability/logger";

export type MapOperationalFailureKind =
  | "preflight"
  | "initialization"
  | "provider_load"
  | "style_load"
  | "layer_load"
  | "geojson_fetch"
  | "container_unavailable"
  | "runtime";

export type MapOperationalFailure = {
  kind: MapOperationalFailureKind;
  message?: string;
  provider?: string;
  layerId?: string;
  missingEnvVars?: string[];
  warnings?: string[];
  fatal?: boolean;
};

type MapOperationalBoundaryProps = {
  children?: ReactNode;
  environment?: AppEnvironmentName;
  failure?: MapOperationalFailure | null;
  validation?: EnvValidationResult | null;
};

const nonFatalKinds = new Set<MapOperationalFailureKind>(["layer_load", "geojson_fetch"]);

const toDetailList = (
  validation: EnvValidationResult | null | undefined,
  failure: MapOperationalFailure | null | undefined
) => {
  const details: string[] = [];

  if (failure?.provider) {
    details.push(`Provider: ${sanitizeForLog(failure.provider) as string}`);
  }
  if (failure?.layerId) {
    details.push(`Layer: ${sanitizeForLog(failure.layerId) as string}`);
  }
  if (failure?.missingEnvVars?.length) {
    details.push(`Missing env: ${failure.missingEnvVars.join(", ")}`);
  }
  if (validation?.errors?.length) {
    details.push(...validation.errors.map((entry) => sanitizeForLog(entry) as string));
  }
  if (failure?.warnings?.length) {
    details.push(...failure.warnings.map((entry) => sanitizeForLog(entry) as string));
  }
  if (validation?.warnings?.length) {
    details.push(...validation.warnings.map((entry) => sanitizeForLog(entry) as string));
  }
  if (failure?.message) {
    details.push(sanitizeForLog(failure.message) as string);
  }

  return Array.from(new Set(details));
};

const FallbackCard = ({
  details,
  overlay
}: {
  details: string[];
  overlay: boolean;
}) => (
  <div
    className={overlay ? "atlas-map-note" : "atlas-map-state-card"}
    data-testid={overlay ? "map-operational-overlay" : "map-operational-boundary"}
    role="alert"
  >
    <strong>Map unavailable</strong>
    <p>Configuration or network issue prevented the map from loading.</p>
    <p>Try again later.</p>
    {details.length > 0 ? (
      <div>
        {details.map((detail) => (
          <p key={detail}>{detail}</p>
        ))}
      </div>
    ) : null}
  </div>
);

export function MapOperationalBoundary({
  children,
  environment = appEnv.appEnv,
  failure,
  validation
}: MapOperationalBoundaryProps) {
  const isDev = environment !== "production";
  const validationFailed = Boolean(validation && !validation.valid);
  const fatalFailure = Boolean(
    failure && (failure.fatal ?? !nonFatalKinds.has(failure.kind))
  );
  const details = isDev ? toDetailList(validation, failure) : [];

  if (validationFailed || fatalFailure) {
    return <FallbackCard details={details} overlay={false} />;
  }

  if (failure) {
    return (
      <>
        {children}
        <FallbackCard details={details} overlay />
      </>
    );
  }

  return <>{children}</>;
}
