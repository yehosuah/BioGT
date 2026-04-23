"use client";

import { useId } from "react";
import clsx from "clsx";

import { getMapIcon } from "@/features/map/assets/iconRegistry";
import type { MapIconId, MapSvgNode } from "@/features/map/assets/iconTypes";

type MapIconProps = {
  iconId: MapIconId | string;
  size?: number;
  className?: string;
  title?: string;
  ariaLabel?: string;
  decorative?: boolean;
};

const renderNode = (node: MapSvgNode, index: number) => {
  if (node.type === "path") {
    return <path key={index} {...node} />;
  }

  if (node.type === "circle") {
    return <circle key={index} {...node} />;
  }

  if (node.type === "line") {
    return <line key={index} {...node} />;
  }

  return <rect key={index} {...node} />;
};

export function MapIcon({
  iconId,
  size,
  className,
  title,
  ariaLabel,
  decorative = false
}: MapIconProps) {
  const metadata = getMapIcon(iconId);
  const titleId = useId();
  const resolvedTitle = title ?? metadata.accessibilityLabel;
  const label = ariaLabel ?? resolvedTitle;

  if (!metadata.definition) {
    return null;
  }

  return (
    <svg
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      aria-labelledby={decorative ? undefined : titleId}
      className={clsx("map-icon", className)}
      role={decorative ? undefined : "img"}
      style={{ width: size ?? metadata.defaultSize, height: size ?? metadata.defaultSize }}
      viewBox={metadata.definition.viewBox}
      xmlns="http://www.w3.org/2000/svg"
    >
      {!decorative ? <title id={titleId}>{resolvedTitle}</title> : null}
      {metadata.definition.nodes.map((node, index) => renderNode(node, index))}
    </svg>
  );
}
