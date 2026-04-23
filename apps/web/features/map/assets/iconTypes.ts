import type { ReactNode, SVGProps } from "react";

export const mapIconIds = [
  "default-place",
  "selected-place",
  "route-start",
  "route-end",
  "alert",
  "search-result",
  "user-location",
  "cluster",
  "restaurant",
  "service",
  "department-mask",
  "protected-area",
  "public-cell",
  "species-presence"
] as const;

export type MapIconId = (typeof mapIconIds)[number];
export type MapIconRole =
  | "marker"
  | "legend"
  | "status"
  | "route"
  | "control"
  | "overlay";
export type MapIconColorMode = "currentColor" | "fixed" | "themed";

export type MapIconFeatureLike =
  | {
      iconId?: string | null;
      category?: string | null;
      type?: string | null;
      kind?: string | null;
      status?: string | null;
      priority?: string | number | null;
      selected?: boolean | null;
      isCluster?: boolean | null;
      isUserLocation?: boolean | null;
      isRouteStart?: boolean | null;
      isRouteEnd?: boolean | null;
      mode?: string | null;
    }
  | {
      properties?: Record<string, unknown> | null;
    };

type SvgBaseNode = {
  fill?: string;
  stroke?: string;
  strokeLinecap?: SVGProps<SVGElement>["strokeLinecap"];
  strokeLinejoin?: SVGProps<SVGElement>["strokeLinejoin"];
  strokeWidth?: number;
  opacity?: number;
};

export type MapSvgNode =
  | (SvgBaseNode & {
      type: "path";
      d: string;
      fillRule?: SVGProps<SVGPathElement>["fillRule"];
      clipRule?: SVGProps<SVGPathElement>["clipRule"];
    })
  | (SvgBaseNode & {
      type: "circle";
      cx: number;
      cy: number;
      r: number;
    })
  | (SvgBaseNode & {
      type: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    })
  | (SvgBaseNode & {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      rx?: number;
      ry?: number;
    });

export type MapLegendSwatch =
  | {
      type: "fill";
      fill: string;
      stroke?: string;
      shape?: "circle" | "rounded-rect";
    }
  | {
      type: "line";
      stroke: string;
      strokeWidth?: number;
    };

export type MapIconDefinition = {
  viewBox: string;
  nodes: MapSvgNode[];
};

export type MapIconMetadata = {
  id: MapIconId;
  label: string;
  role: MapIconRole;
  defaultSize: number;
  colorMode: MapIconColorMode;
  accessibilityLabel: string;
  assetPath?: string;
  definition?: MapIconDefinition;
  legendSwatch?: MapLegendSwatch;
  providerHints?: {
    anchor?: "center" | "bottom";
    prefersDomMarker?: boolean;
  };
};

export type MapLegendItem = {
  iconId: MapIconId;
  label?: string;
  description?: ReactNode;
  styleKey?: string;
  styleContext?: {
    viewMode?: string;
  };
};
