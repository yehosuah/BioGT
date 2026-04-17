import clsx from "clsx";

import type { SourceTier } from "@/lib/types";

const tierLabels: Record<SourceTier, string> = {
  official: "Oficial",
  institutional: "Institucional",
  community: "Comunitaria"
};

export function SourceBadge({ tier }: { tier: SourceTier }) {
  return <span className={clsx("source-badge", `source-badge-${tier}`)}>{tierLabels[tier]}</span>;
}

