import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MapOperationalBoundary } from "@/features/map/components/MapOperationalBoundary";

describe("MapOperationalBoundary", () => {
  it("shows fallback on validation failure", () => {
    const html = renderToStaticMarkup(
      createElement(
        MapOperationalBoundary,
        {
          environment: "production",
          validation: {
            valid: false,
            errors: ["Missing NEXT_PUBLIC_MAPBOX_TOKEN"],
            warnings: []
          }
        },
        createElement("div", null, "map child")
      )
    );

    expect(html).toContain("Map unavailable");
    expect(html).toContain("Configuration or network issue prevented the map from loading.");
    expect(html).not.toContain("map child");
  });

  it("includes dev detail only in development", () => {
    const devHtml = renderToStaticMarkup(
      createElement(MapOperationalBoundary, {
        environment: "development",
        failure: {
          kind: "preflight",
          provider: "mapbox",
          message: "Missing NEXT_PUBLIC_MAPBOX_TOKEN pk.secret",
          missingEnvVars: ["NEXT_PUBLIC_MAPBOX_TOKEN"],
          warnings: ["Using fallback style"]
        },
        validation: {
          valid: false,
          errors: ["Missing NEXT_PUBLIC_MAPBOX_TOKEN"],
          warnings: ["Using fallback style"]
        }
      })
    );
    const prodHtml = renderToStaticMarkup(
      createElement(MapOperationalBoundary, {
        environment: "production",
        failure: {
          kind: "preflight",
          provider: "mapbox",
          message: "Missing NEXT_PUBLIC_MAPBOX_TOKEN pk.secret",
          missingEnvVars: ["NEXT_PUBLIC_MAPBOX_TOKEN"]
        },
        validation: {
          valid: false,
          errors: ["Missing NEXT_PUBLIC_MAPBOX_TOKEN"],
          warnings: []
        }
      })
    );

    expect(devHtml).toContain("NEXT_PUBLIC_MAPBOX_TOKEN");
    expect(devHtml).toContain("mapbox");
    expect(prodHtml).not.toContain("NEXT_PUBLIC_MAPBOX_TOKEN");
    expect(prodHtml).not.toContain("mapbox");
  });

  it("does not expose token values", () => {
    const html = renderToStaticMarkup(
      createElement(MapOperationalBoundary, {
        environment: "development",
        failure: {
          kind: "preflight",
          message: "Token pk.abcdefghijklmnopqrstuvwxyz123456 failed",
          missingEnvVars: ["NEXT_PUBLIC_MAPBOX_TOKEN"]
        }
      })
    );

    expect(html).not.toContain("pk.abcdefghijklmnopqrstuvwxyz123456");
    expect(html).toContain("[REDACTED]");
  });
});
