import type { MapIconDefinition, MapIconId } from "@/features/map/assets/iconTypes";

const current = "currentColor";
const white = "#fff";

export const iconDefinitions: Record<
  Exclude<MapIconId, "department-mask" | "protected-area" | "public-cell" | "species-presence">,
  MapIconDefinition
> = {
  "default-place": {
    viewBox: "0 0 24 24",
    nodes: [
      {
        type: "path",
        fill: current,
        d: "M12 22c3.447-4.417 6-7.719 6-11a6 6 0 1 0-12 0c0 3.281 2.553 6.583 6 11Zm0-8.25a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z"
      }
    ]
  },
  "selected-place": {
    viewBox: "0 0 24 24",
    nodes: [
      {
        type: "path",
        fill: current,
        d: "M12 22c3.447-4.417 6-7.719 6-11a6 6 0 1 0-12 0c0 3.281 2.553 6.583 6 11Zm0-7.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"
      },
      {
        type: "circle",
        cx: 12,
        cy: 11,
        r: 5,
        fill: "none",
        stroke: current,
        strokeWidth: 1.5
      }
    ]
  },
  "route-start": {
    viewBox: "0 0 24 24",
    nodes: [
      {
        type: "circle",
        cx: 8,
        cy: 8,
        r: 4.5,
        fill: current
      },
      {
        type: "line",
        x1: 8,
        y1: 12.5,
        x2: 8,
        y2: 20,
        stroke: current,
        strokeWidth: 2,
        strokeLinecap: "round"
      },
      {
        type: "path",
        d: "M8 20h8.5a2.5 2.5 0 0 0 0-5H13",
        fill: "none",
        stroke: current,
        strokeWidth: 2,
        strokeLinecap: "round"
      }
    ]
  },
  "route-end": {
    viewBox: "0 0 24 24",
    nodes: [
      {
        type: "line",
        x1: 7,
        y1: 4,
        x2: 7,
        y2: 20,
        stroke: current,
        strokeWidth: 2,
        strokeLinecap: "round"
      },
      {
        type: "path",
        fill: current,
        d: "M8.5 5.5h8l-1.8 4 1.8 4h-8Z"
      }
    ]
  },
  alert: {
    viewBox: "0 0 24 24",
    nodes: [
      {
        type: "path",
        fill: current,
        d: "M12.866 3.5 20 17.2A1.8 1.8 0 0 1 18.4 20H5.6A1.8 1.8 0 0 1 4 17.2L11.134 3.5a.98.98 0 0 1 1.732 0Z"
      },
      {
        type: "line",
        x1: 12,
        y1: 8,
        x2: 12,
        y2: 12.75,
        stroke: white,
        strokeWidth: 1.8,
        strokeLinecap: "round"
      },
      {
        type: "circle",
        cx: 12,
        cy: 16.3,
        r: 1.1,
        fill: white
      }
    ]
  },
  "search-result": {
    viewBox: "0 0 24 24",
    nodes: [
      {
        type: "path",
        fill: current,
        d: "M12 22c3.447-4.417 6-7.719 6-11a6 6 0 1 0-12 0c0 3.281 2.553 6.583 6 11Z"
      },
      {
        type: "circle",
        cx: 11,
        cy: 10.5,
        r: 2.75,
        fill: "none",
        stroke: white,
        strokeWidth: 1.8
      },
      {
        type: "line",
        x1: 13.2,
        y1: 12.7,
        x2: 15.3,
        y2: 14.8,
        stroke: white,
        strokeWidth: 1.8,
        strokeLinecap: "round"
      }
    ]
  },
  "user-location": {
    viewBox: "0 0 24 24",
    nodes: [
      {
        type: "circle",
        cx: 12,
        cy: 12,
        r: 8,
        fill: current,
        opacity: 0.18
      },
      {
        type: "circle",
        cx: 12,
        cy: 12,
        r: 5.5,
        fill: "none",
        stroke: current,
        strokeWidth: 1.6
      },
      {
        type: "circle",
        cx: 12,
        cy: 12,
        r: 2.75,
        fill: current
      }
    ]
  },
  cluster: {
    viewBox: "0 0 24 24",
    nodes: [
      {
        type: "circle",
        cx: 9,
        cy: 10,
        r: 5,
        fill: current,
        opacity: 0.3
      },
      {
        type: "circle",
        cx: 15,
        cy: 10,
        r: 5,
        fill: current,
        opacity: 0.55
      },
      {
        type: "circle",
        cx: 12,
        cy: 15,
        r: 5,
        fill: current
      }
    ]
  },
  restaurant: {
    viewBox: "0 0 24 24",
    nodes: [
      {
        type: "path",
        d: "M7 3v7.5a2.5 2.5 0 0 0 2 2.45V21",
        fill: "none",
        stroke: current,
        strokeWidth: 2,
        strokeLinecap: "round"
      },
      {
        type: "line",
        x1: 4.5,
        y1: 3,
        x2: 4.5,
        y2: 7.5,
        stroke: current,
        strokeWidth: 1.6,
        strokeLinecap: "round"
      },
      {
        type: "line",
        x1: 7,
        y1: 3,
        x2: 7,
        y2: 7.5,
        stroke: current,
        strokeWidth: 1.6,
        strokeLinecap: "round"
      },
      {
        type: "line",
        x1: 9.5,
        y1: 3,
        x2: 9.5,
        y2: 7.5,
        stroke: current,
        strokeWidth: 1.6,
        strokeLinecap: "round"
      },
      {
        type: "path",
        d: "M15 3c1.933 0 3.5 1.567 3.5 3.5V21",
        fill: "none",
        stroke: current,
        strokeWidth: 2,
        strokeLinecap: "round"
      },
      {
        type: "line",
        x1: 15,
        y1: 10,
        x2: 18.5,
        y2: 10,
        stroke: current,
        strokeWidth: 2,
        strokeLinecap: "round"
      }
    ]
  },
  service: {
    viewBox: "0 0 24 24",
    nodes: [
      {
        type: "path",
        fill: current,
        d: "M12 3.5 14.7 6l3.55-.3.75 3.48 3 2-1.8 3.06 1.8 3.06-3 2-.75 3.48-3.55-.3L12 20.5l-2.7 2.5-3.55.3L5 19.82l-3-2 1.8-3.06L2 11.7l3-2 .75-3.48 3.55.3Z"
      },
      {
        type: "line",
        x1: 12,
        y1: 8,
        x2: 12,
        y2: 16,
        stroke: white,
        strokeWidth: 1.8,
        strokeLinecap: "round"
      },
      {
        type: "line",
        x1: 8,
        y1: 12,
        x2: 16,
        y2: 12,
        stroke: white,
        strokeWidth: 1.8,
        strokeLinecap: "round"
      }
    ]
  }
};
