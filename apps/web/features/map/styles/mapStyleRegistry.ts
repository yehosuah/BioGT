import { mapTokens } from "@/features/map/styles/mapTokens";
import type { MapLayerStyleRule } from "@/features/map/styles/mapStyleTypes";

const departmentCoverageOpacity = (near: number, far: number, cutoff = 6.8) => ({
  zoom = 0
}: {
  zoom?: number;
}) => (zoom < cutoff ? near : far);

const publicHexOpacity = (near: number, far: number, cutoff = 8) => ({
  zoom = 0
}: {
  zoom?: number;
}) => (zoom < cutoff ? near : far);

export const mapStyleRegistry = {
  departments: {
    geometryType: "polygon",
    default: {
      fillColor: mapTokens.colors.geometry.departmentMask,
      fillOpacity: 14 / 255,
      strokeColor: mapTokens.colors.base.borderMuted,
      strokeWidth: mapTokens.sizes.line.thin,
      opacity: 148 / 255,
      zIndex: mapTokens.zIndex.polygon,
      labelColor: mapTokens.colors.base.text,
      labelSize: mapTokens.sizes.text.md
    },
    variants: {
      coverage: {
        fillColor: mapTokens.colors.ramps.departmentCoverage.low,
        fillOpacity: departmentCoverageOpacity(72 / 255, 42 / 255)
      },
      species: {
        fillColor: mapTokens.colors.geometry.departmentMask,
        fillOpacity: 14 / 255
      }
    },
    hover: {
      strokeColor: mapTokens.colors.semantic.hover,
      strokeWidth: mapTokens.sizes.line.normal,
      fillOpacity: 96 / 255
    },
    selected: {
      fillColor: mapTokens.colors.geometry.departmentSelected,
      fillOpacity: 164 / 255,
      strokeColor: mapTokens.colors.semantic.selected,
      strokeWidth: mapTokens.sizes.line.focus,
      opacity: 230 / 255,
      zIndex: mapTokens.zIndex.selected
    },
    disabled: {
      fillOpacity: mapTokens.opacity.disabled,
      opacity: mapTokens.opacity.disabled
    },
    dataDriven: [
      {
        kind: "byRange",
        property: "speciesCount",
        when: {
          viewModes: ["coverage"]
        },
        ranges: [
          {
            min: 320,
            style: {
              fillColor: mapTokens.colors.ramps.departmentCoverage.critical,
              fillOpacity: departmentCoverageOpacity(108 / 255, 84 / 255)
            }
          },
          {
            min: 220,
            max: 319,
            style: {
              fillColor: mapTokens.colors.ramps.departmentCoverage.high,
              fillOpacity: departmentCoverageOpacity(94 / 255, 72 / 255)
            }
          },
          {
            min: 140,
            max: 219,
            style: {
              fillColor: mapTokens.colors.ramps.departmentCoverage.medium,
              fillOpacity: departmentCoverageOpacity(82 / 255, 58 / 255)
            }
          },
          {
            max: 139,
            style: {
              fillColor: mapTokens.colors.ramps.departmentCoverage.low,
              fillOpacity: departmentCoverageOpacity(72 / 255, 42 / 255)
            }
          }
        ]
      }
    ],
    labelRule: {
      property: "label"
    }
  },
  protected_areas: {
    geometryType: "polygon",
    default: {
      fillColor: mapTokens.colors.geometry.protectedArea,
      fillOpacity: 18 / 255,
      strokeColor: "#917a48",
      strokeWidth: mapTokens.sizes.line.normal,
      opacity: 156 / 255,
      zIndex: mapTokens.zIndex.polygon,
      labelColor: mapTokens.colors.base.text,
      labelSize: mapTokens.sizes.text.md
    },
    variants: {
      coverage: {
        fillColor: mapTokens.colors.geometry.protectedArea,
        fillOpacity: ({ zoom = 0 }) => (zoom >= 7 ? 58 / 255 : 26 / 255)
      },
      species: {
        fillOpacity: 18 / 255
      }
    },
    hover: {
      strokeColor: mapTokens.colors.semantic.hover,
      strokeWidth: mapTokens.sizes.line.emphasized,
      fillOpacity: 88 / 255
    },
    selected: {
      fillColor: mapTokens.colors.geometry.protectedArea,
      fillOpacity: 150 / 255,
      strokeColor: mapTokens.colors.semantic.selected,
      strokeWidth: mapTokens.sizes.line.heavy,
      opacity: 220 / 255,
      zIndex: mapTokens.zIndex.selected
    },
    disabled: {
      fillOpacity: mapTokens.opacity.disabled,
      opacity: mapTokens.opacity.disabled
    },
    labelRule: {
      property: "label"
    }
  },
  public_hex: {
    geometryType: "polygon",
    default: {
      fillColor: mapTokens.colors.ramps.richness.low,
      fillOpacity: publicHexOpacity(74 / 255, 102 / 255),
      strokeColor: mapTokens.colors.geometry.boundaryMuted,
      strokeWidth: mapTokens.sizes.line.hairline,
      opacity: 88 / 255,
      zIndex: mapTokens.zIndex.polygon,
      labelColor: mapTokens.colors.base.text,
      labelSize: mapTokens.sizes.text.sm
    },
    hover: {
      strokeColor: mapTokens.colors.semantic.hover,
      strokeWidth: mapTokens.sizes.line.normal,
      fillOpacity: publicHexOpacity(98 / 255, 132 / 255)
    },
    selected: {
      fillColor: "#2e6853",
      fillOpacity: 188 / 255,
      strokeColor: mapTokens.colors.semantic.selected,
      strokeWidth: mapTokens.sizes.line.emphasized,
      opacity: 235 / 255,
      zIndex: mapTokens.zIndex.selected
    },
    disabled: {
      fillOpacity: mapTokens.opacity.disabled,
      opacity: mapTokens.opacity.disabled
    },
    dataDriven: [
      {
        kind: "byRange",
        property: "speciesCount",
        when: {
          viewModes: ["coverage"]
        },
        ranges: [
          {
            min: 240,
            style: {
              fillColor: mapTokens.colors.ramps.richness.critical,
              fillOpacity: publicHexOpacity(120 / 255, 152 / 255)
            }
          },
          {
            min: 160,
            max: 239,
            style: {
              fillColor: mapTokens.colors.ramps.richness.high,
              fillOpacity: publicHexOpacity(102 / 255, 136 / 255)
            }
          },
          {
            min: 90,
            max: 159,
            style: {
              fillColor: mapTokens.colors.ramps.richness.medium,
              fillOpacity: publicHexOpacity(88 / 255, 118 / 255)
            }
          },
          {
            max: 89,
            style: {
              fillColor: mapTokens.colors.ramps.richness.low,
              fillOpacity: publicHexOpacity(74 / 255, 102 / 255)
            }
          }
        ]
      }
    ],
    labelRule: {
      property: "biodiversityLabel"
    }
  },
  species_presence: {
    geometryType: "polygon",
    default: {
      fillColor: mapTokens.colors.geometry.speciesPresence,
      fillOpacity: 70 / 255,
      strokeColor: "#16523c",
      strokeWidth: mapTokens.sizes.line.thin,
      opacity: 180 / 255,
      zIndex: mapTokens.zIndex.polygon,
      labelColor: mapTokens.colors.base.text,
      labelSize: mapTokens.sizes.text.sm
    },
    hover: {
      strokeColor: mapTokens.colors.semantic.hover,
      strokeWidth: mapTokens.sizes.line.emphasized,
      fillOpacity: 96 / 255
    },
    selected: {
      fillColor: mapTokens.colors.geometry.speciesPresence,
      fillOpacity: 156 / 255,
      strokeColor: mapTokens.colors.semantic.selected,
      strokeWidth: mapTokens.sizes.line.heavy,
      opacity: 220 / 255,
      zIndex: mapTokens.zIndex.selected
    },
    disabled: {
      fillOpacity: mapTokens.opacity.disabled,
      opacity: mapTokens.opacity.disabled
    },
    labelRule: {
      property: "label"
    }
  },
  species_markers: {
    geometryType: "point",
    default: {
      surfaceColor: mapTokens.colors.base.surfaceStrong,
      strokeColor: mapTokens.colors.base.border,
      strokeWidth: 1,
      textColor: mapTokens.colors.base.text,
      badgeColor: mapTokens.colors.semantic.primary,
      badgeTextColor: mapTokens.colors.base.surfaceStrong,
      iconColor: mapTokens.colors.base.surfaceStrong,
      iconSize: 18,
      radius: mapTokens.sizes.marker.md,
      opacity: mapTokens.opacity.strong,
      zIndex: mapTokens.zIndex.point
    },
    variants: {
      coverage: {
        iconSize: 18
      },
      species: {
        iconSize: 20
      }
    },
    hover: {
      strokeColor: mapTokens.colors.semantic.hover,
      strokeWidth: 1.6,
      badgeColor: mapTokens.colors.semantic.hover
    },
    selected: {
      strokeColor: mapTokens.colors.semantic.selected,
      strokeWidth: 2,
      badgeColor: mapTokens.colors.semantic.selected,
      iconSize: 20,
      zIndex: mapTokens.zIndex.selected
    }
  },
  marker_clusters: {
    geometryType: "point",
    default: {
      surfaceColor: mapTokens.colors.base.surfaceStrong,
      strokeColor: mapTokens.colors.semantic.primary,
      strokeWidth: 1,
      textColor: mapTokens.colors.base.text,
      badgeColor: mapTokens.colors.semantic.primary,
      badgeTextColor: mapTokens.colors.base.surfaceStrong,
      opacity: mapTokens.opacity.strong,
      radius: mapTokens.sizes.marker.lg,
      zIndex: mapTokens.zIndex.point
    },
    hover: {
      strokeColor: mapTokens.colors.semantic.hover,
      strokeWidth: 1.6,
      badgeColor: mapTokens.colors.semantic.hover
    },
    selected: {
      strokeColor: mapTokens.colors.semantic.selected,
      strokeWidth: 2,
      badgeColor: mapTokens.colors.semantic.selected,
      zIndex: mapTokens.zIndex.selected
    }
  }
} satisfies Record<string, MapLayerStyleRule>;

export type MapStyleKey = keyof typeof mapStyleRegistry;
