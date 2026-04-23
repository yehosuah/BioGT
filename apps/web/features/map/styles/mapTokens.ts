import type { MapColor } from "@/features/map/core/MapTypes";

type HexColor = `#${string}`;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const hexToRgb = (hex: HexColor) => {
  const normalized = hex.replace("#", "");
  const pairs =
    normalized.length === 3
      ? normalized.split("").map((value) => `${value}${value}`)
      : [normalized.slice(0, 2), normalized.slice(2, 4), normalized.slice(4, 6)];

  return {
    red: Number.parseInt(pairs[0] ?? "00", 16),
    green: Number.parseInt(pairs[1] ?? "00", 16),
    blue: Number.parseInt(pairs[2] ?? "00", 16)
  };
};

export const mapTokens = {
  colors: {
    base: {
      background: "#e7eee7",
      surface: "#fcfaf5",
      surfaceStrong: "#ffffff",
      border: "#142621",
      borderMuted: "#5f766f",
      text: "#0f201f",
      mutedText: "#60706b"
    },
    semantic: {
      primary: "#295847",
      selected: "#17392d",
      hover: "#6a8d87",
      active: "#295847",
      inactive: "#60706b",
      danger: "#8c4b3d",
      warning: "#b08a43",
      success: "#295847",
      info: "#6a8d87",
      focused: "#17392d",
      disabled: "#a3b1aa"
    },
    geometry: {
      point: "#295847",
      line: "#295847",
      polygon: "#6a8d87",
      route: "#b08a43",
      boundary: "#17392d",
      boundaryMuted: "#5b7463",
      departmentMask: "#5c7476",
      departmentSelected: "#205858",
      protectedArea: "#c8b784",
      publicHex: "#648a6f",
      speciesPresence: "#327a5a"
    },
    status: {
      active: "#295847",
      inactive: "#60706b",
      pending: "#b08a43",
      warning: "#b08a43",
      danger: "#8c4b3d",
      unknown: "#6a8d87"
    },
    category: {
      restaurant: "#b08a43",
      service: "#6a8d87",
      flora: "#295847",
      fauna: "#7d8f61",
      neutral: "#60706b"
    },
    ramps: {
      departmentCoverage: {
        critical: "#3f6f68",
        high: "#5e857a",
        medium: "#83a190",
        low: "#abbeac"
      },
      richness: {
        critical: "#46745c",
        high: "#648a6f",
        medium: "#84a087",
        low: "#a9beaa"
      }
    }
  },
  sizes: {
    marker: {
      xs: 12,
      sm: 16,
      md: 24,
      lg: 32,
      xl: 44
    },
    line: {
      hairline: 0.72,
      thin: 1.1,
      normal: 1.15,
      emphasized: 2,
      heavy: 2.6,
      focus: 3
    },
    text: {
      sm: 11,
      md: 12,
      lg: 14
    }
  },
  opacity: {
    hidden: 0,
    disabled: 0.18,
    background: 0.28,
    subtle: 0.24,
    muted: 0.45,
    normal: 0.75,
    strong: 0.92,
    solid: 1
  },
  zIndex: {
    base: 0,
    polygon: 10,
    line: 20,
    point: 30,
    selected: 50,
    popup: 60
  }
} as const;

export const withAlpha = (color: HexColor, opacity: number): string => {
  const { red, green, blue } = hexToRgb(color);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(opacity, 0, 1)})`;
};

export const toMapColor = (color: HexColor, opacity = 1): MapColor => {
  const { red, green, blue } = hexToRgb(color);
  return [red, green, blue, Math.round(clamp(opacity, 0, 1) * 255)];
};

export const scaleOpacity = (baseOpacity: number, opacityOverride?: number) =>
  clamp(opacityOverride ?? baseOpacity, 0, 1);
